class XmlMatcher {
    constructor(tagName, transform, position = 0) {
        this.tagName = tagName;
        this.transform = transform;
        this.position = position;
        this.index = 0;
        this.chunks = [];
        this.cached = [];
        this.matched = false;
        this.state = "TEXT";
        this.depth = 0;
        this.pointer = 0;
    }

    collect() {
        if (!this.cached.length) {
            return;
        }
        const last = this.chunks[this.chunks.length - 1];
        const data = this.cached.join("");
        const matched = this.matched;
        if (last?.matched === matched) {
            last.data += data;
        } else {
            this.chunks.push({
                data,
                matched,
            });
        }
        this.cached = [];
    }

    pop() {
        const chunks = this.chunks;
        this.chunks = [];
        if (!this.transform) {
            return chunks;
        }
        return chunks.map(this.transform);
    }

    _update(chunk) {
        for (const char of chunk) {
            this.cached.push(char);
            this.pointer++;

            if (this.state === "TEXT") {
                if (char === "<" && (this.pointer <= this.position + 1 || this.matched)) {
                    this.state = "TAG_OPEN";
                    this.index = 0;
                } else {
                    this.collect();
                }
            } else if (this.state === "TAG_OPEN") {
                if (char === ">" && this.index === this.tagName.length) {
                    this.state = "TEXT";
                    if (!this.matched) {
                        this.cached = [];
                    }
                    this.depth++;
                    this.matched = true;
                } else if (this.index === 0 && char === "/") {
                    this.state = "TAG_CLOSE";
                } else if (char === " " && (this.index === 0 || this.index === this.tagName.length)) {
                    continue;
                } else if (this.tagName[this.index] === char) {
                    this.index++;
                } else {
                    this.state = "TEXT";
                    this.collect();
                }
            } else if (this.state === "TAG_CLOSE") {
                if (char === ">" && this.index === this.tagName.length) {
                    this.state = "TEXT";
                    this.depth--;
                    this.matched = this.depth > 0;
                    if (!this.matched) {
                        this.cached = [];
                    }
                } else if (char === " " && (this.index === 0 || this.index === this.tagName.length)) {
                    continue;
                } else if (this.tagName[this.index] === char) {
                    this.index++;
                } else {
                    this.state = "TEXT";
                    this.collect();
                }
            }
        }
    }

    final(chunk) {
        if (chunk) {
            this._update(chunk);
        }
        this.collect();
        return this.pop();
    }

    update(chunk) {
        this._update(chunk);
        return this.pop();
    }
}

module.exports = { XmlMatcher };