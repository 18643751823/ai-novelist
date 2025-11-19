# Qingzhu v0.1.0

[中文版](README.md) | English Version

> **Version Note**: As this is a personal learning project, version management was somewhat chaotic in the early stages. Therefore, version management has been restarted from v0.1.0.

![Project Screenshot](images/示例图片.jpg)
## Project Introduction

Qingzhu (Official Name) is an intelligent writing assistant tool with a Python backend and JavaScript frontend architecture, providing comprehensive writing support.

**Core Features**:
*   **AI Smart Interaction**: Real-time conversation with AI to assist in creative writing.
*   **Chapter Management**: Create, edit, delete, and organize chapters.
*   **Content Editor**: Rich text editor based on Tiptap.
*   **Writing Style Imitation**: Based on RAG technology, retrieves text fragments to enhance AI capabilities.
*   **Tool Calling**: Supports tool calling similar to vibecoding to solve problems, with some features still under development.

## Technology Stack

### Frontend Technologies
*   **React**: Frontend user interface framework
*   **Redux**: Frontend state management library
*   **Tiptap**: Rich text editor framework

### Backend Technologies
*   **LangChain**: Toolchain for building AI applications
*   **LangGraph**: Graph-based AI workflow orchestration framework
*   **LiteLLM**: Unified AI model calling interface
*   **LanceDB**: Vector database providing semantic search and knowledge base management



## Quick Start

### Installation & Startup

1.  **Clone the repository**:
    ```bash
    git clone git@github.com:FlickeringLamp/ai-novelist.git
    cd ai-novelist
    ```


2.  **Install frontend dependencies**:
    Enter the frontend directory (`frontend/`) and install dependencies, build frontend, and start:
    ```bash
    cd frontend
    npm install
    npm run build
    npm start
    ```


3.  **Install backend dependencies**:
    From the root directory (`ai-novelist`), create a virtual environment, activate it, install backend dependencies, and start:
    ```bash
    python -m venv backend_env
    backend_env\Scripts\activate
    cd backend
    pip install -r requirements.txt
    python main.py
    ```

4.  **Install litellm gateway**:
    Enter the root directory (`ai-novelist`), create a virtual environment (any name), install litellm, and start it. (Configure `backend/api_provider/config.yaml` yourself)
    ```bash
    python -m venv litellm_env
    litellm_env\Scripts\activate
    pip install 'litellm[proxy]'
    litellm --config backend/api_provider/config.yaml --port 4000 --host 0.0.0.0 --debug
    ```

5.  **Browser Access**:
    Access localhost:3000 in your browser



## Contribution

We welcome all forms of contributions! If you find bugs, have feature suggestions, or wish to submit code, please feel free to participate via GitHub Issues or Pull Requests.

To maintain the project's healthy development, please ensure:
- Submitted code is compatible with the [MIT License](LICENSE)
- Avoid introducing code that is incompatible with the MIT License

**Note about DCO**: Previously, this project had DCO (Developer Certificate of Origin) requirements, but the checks were not properly removed. All DCO checks and requirements have now been completely removed. Contributors no longer need to sign off on their commits.

Thank you for your support!

## License

This project uses the [MIT License](LICENSE).


---

## Acknowledgements

This project's development has been heavily inspired by the `roo-code` project. We extend our sincere gratitude to the developers of `roo-code`.

The `roo-code` project is licensed under the Apache License 2.0. In compliance with its terms, we have included the original license notice within our project, which can be found in the [`LICENSE-roo-code.txt`](./LICENSE-roo-code.txt) file.