import React, { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { diffChars } from 'diff';
import './DiffViewer.css';
import { convertTextToTiptapJson } from '../../utils/tiptap-helpers';

// Tiptap 扩展，用于应用差异高亮
const DiffHighlightExtension = (decorations) => ({
  name: 'diffHighlight',
  addProseMirrorPlugins() {
    return [
      {
        props: {
          decorations() {
            return DecorationSet.create(this.doc, decorations);
          },
        },
      },
    ];
  },
});

function DiffViewer({ originalContent, currentContent }) {
  const leftEditorRef = useRef(null);
  const rightEditorRef = useRef(null);
  const leftTiptapInstance = useRef(null);
  const rightTiptapInstance = useRef(null);
  const isSyncingScroll = useRef(false);
 
   useEffect(() => {
    const changes = diffChars(originalContent, currentContent);
    const leftDecorations = [];
    const rightDecorations = [];

    let leftPos = 1; // ProseMirror positions are 1-based
    let rightPos = 1;

    changes.forEach(part => {
      const { value, added, removed } = part;
      const length = value.length;

      if (added) {
        rightDecorations.push(
          Decoration.inline(rightPos, rightPos + length, { class: 'diff-added' })
        );
        rightPos += length;
      } else if (removed) {
        leftDecorations.push(
          Decoration.inline(leftPos, leftPos + length, { class: 'diff-removed' })
        );
        leftPos += length;
      } else {
        leftPos += length;
        rightPos += length;
      }
    });

    // 初始化或更新左侧编辑器 (Original)
    if (!leftTiptapInstance.current) {
      leftTiptapInstance.current = new Editor({
        element: leftEditorRef.current,
        extensions: [StarterKit, DiffHighlightExtension(leftDecorations)],
        content: convertTextToTiptapJson(originalContent),
        editable: false,
      });
    } else {
      leftTiptapInstance.current.setOptions({
        extensions: [StarterKit, DiffHighlightExtension(leftDecorations)],
      });
    }

    // 初始化或更新右侧编辑器 (Current)
    if (!rightTiptapInstance.current) {
      rightTiptapInstance.current = new Editor({
        element: rightEditorRef.current,
        extensions: [StarterKit, DiffHighlightExtension(rightDecorations)],
        content: convertTextToTiptapJson(currentContent),
        editable: true, // or false if you want it read-only
      });
    } else {
      // 仅在内容不同步时更新，避免不必要的重渲染
      if (rightTiptapInstance.current.getText() !== currentContent) {
          rightTiptapInstance.current.commands.setContent(convertTextToTiptapJson(currentContent));
      }
      rightTiptapInstance.current.setOptions({
        extensions: [StarterKit, DiffHighlightExtension(rightDecorations)],
      });
    }

  }, [originalContent, currentContent]);

  useEffect(() => {
    // Cleanup
    return () => {
      leftTiptapInstance.current?.destroy();
      rightTiptapInstance.current?.destroy();
    };
  }, []);

  // Effect for syncing scroll between the two editors
  useEffect(() => {
   const leftEditorEl = leftEditorRef.current?.querySelector('.ProseMirror');
   const rightEditorEl = rightEditorRef.current?.querySelector('.ProseMirror');

   if (!leftEditorEl || !rightEditorEl) return;
   
   let syncTimeout = null;

   const handleScroll = (source, target) => {
     // If a sync is already in progress, do nothing
     if (isSyncingScroll.current) return;

     // Set the lock
     isSyncingScroll.current = true;
     
     // Sync the scroll position
     target.scrollTop = source.scrollTop;

     // Clear any existing timeout to reset the lock
     clearTimeout(syncTimeout);
     
     // Reset the lock after a short delay to allow the scroll event to settle
     syncTimeout = setTimeout(() => {
       isSyncingScroll.current = false;
     }, 50); // A 50ms delay is usually sufficient
   };

   const leftScrollHandler = () => handleScroll(leftEditorEl, rightEditorEl);
   const rightScrollHandler = () => handleScroll(rightEditorEl, leftEditorEl);

   leftEditorEl.addEventListener('scroll', leftScrollHandler);
   rightEditorEl.addEventListener('scroll', rightScrollHandler);

   return () => {
     leftEditorEl.removeEventListener('scroll', leftScrollHandler);
     rightEditorEl.removeEventListener('scroll', rightScrollHandler);
     clearTimeout(syncTimeout); // Cleanup the timeout on unmount
   };
  }, []); // Empty dependency array ensures this runs only once after mount.

  return (
    <div className="diff-viewer-container">
      <div className="diff-panel">
        <div className="panel-title">原始版本</div>
        <div ref={leftEditorRef} className="diff-editor"></div>
      </div>
      <div className="diff-panel">
        <div className="panel-title">修改后版本</div>
        <div ref={rightEditorRef} className="diff-editor"></div>
      </div>
    </div>
  );
}

export default DiffViewer;