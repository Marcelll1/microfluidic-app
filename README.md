# Microfluidic 3D Designer

An interactive 3D web application for designing microfluidic channel models and generating simulation-ready Python code.

![3D Editor](screenshots/3d-editor.png)

The application was developed as a Bachelor's thesis at the **University of Žilina, Faculty of Management Science and Informatics**.

Its primary goal is to simplify the preparation of microfluidic models for the **ESPResSoMD** simulation environment with the **PyOIF** module.

Instead of manually defining geometric parameters and coordinates directly in simulation source code, users can construct models visually in an interactive 3D environment and automatically generate the corresponding Python simulation code.

## Overview

The application combines an interactive 3D editor with project management, user authentication, database storage and automated code generation.

Users can:

- create and manipulate 3D objects in an interactive scene
- precisely define object position, size and rotation using X, Y and Z coordinates
- construct microfluidic channel geometries visually
- perform geometric operations on objects
- import cell models
- generate and distribute multiple embedded objects
- save and manage projects
- share projects with other users
- use project templates
- automatically generate Python simulation scripts
- export designed scenes and generated simulation data

The application is designed to reduce manual parameter configuration and make the preparation of microfluidic simulation models more accessible and less error-prone.

## Key Features

### Interactive 3D Editor

The core of the application is an interactive 3D workspace built around **Three.js** and **React Three Fiber**.

The editor provides:

- real-time 3D visualization
- camera navigation using OrbitControls
- interactive spatial manipulation
- object translation and rotation
- precise numerical transformation parameters
- object selection and property editing
- object creation and management
- geometric modeling operations

The combination of direct manipulation and numerical input allows users to work intuitively while maintaining precise control over the resulting geometry.

### Microfluidic Geometry Modeling

The application allows users to construct complex microfluidic scenes from 3D objects.

The implemented geometry-processing functionality includes operations such as:

- Constructive Solid Geometry (CSG)
- object clipping
- object unions
- edge beveling
- spatial transformations

These operations allow individual primitives to be combined into more complex channel structures.

### Cell and Embedded Object Generation

The application supports working with cells and other embedded objects inside the designed environment.

Users can define parameters for multiple objects and generate their placement within a selected 3D region.

Supported functionality includes:

- random distribution
- structured distribution
- parameterized bulk generation

### Python Code Generation

One of the main features of the application is automatic generation of Python simulation code.

The application takes the designed 3D scene and converts its geometry and transformations into Python code intended for use with:

- **ESPResSoMD**
- **PyOIF**

The code-generation process is handled through the application's API, allowing the browser-based editor to remain focused on interactive scene manipulation.

This removes the need to manually define complex geometries and coordinates directly in simulation source code.

### Project Management

The application includes a project management system allowing users to:

- create projects
- save project states
- manage their own projects
- use project templates
- access shared projects
- explore publicly available projects

### User Authentication and Security

User authentication and project data are backed by **Supabase** and **PostgreSQL**.

The application uses **Row-Level Security (RLS)** policies to control access to stored data and prevent unauthorized users from modifying or deleting other users' project data.

The system also includes functionality for:

- user authentication
- project ownership
- project sharing
- friend management
- access control

## Architecture

The application consists of three main parts:

### Frontend

The frontend is built using **Next.js**, **React**, **React Three Fiber** and **Three.js**.

It provides:

- the user interface
- project management
- interactive 3D scene manipulation
- object editing
- cell model handling
- simulation configuration

### Backend and Database

Application APIs handle data processing and communication between the frontend and backend services.

**Supabase** and **PostgreSQL** provide:

- persistent data storage
- user authentication
- project management
- access control
- Row-Level Security policies

### Code Generation

The designed scene is processed and converted into Python simulation code.

The generated code is intended for use with:

- **ESPResSoMD**
- **PyOIF**

## Technologies

### Frontend

- **TypeScript**
- **React**
- **Next.js**
- **React Three Fiber (R3F)**
- **Three.js**
- **Tailwind CSS**
- **WebGL**

### Backend and Database

- **Supabase**
- **PostgreSQL**
- **Row-Level Security (RLS)**
- **REST APIs**

### Simulation and Code Generation

- **Python**
- **ESPResSoMD**
- **PyOIF**

### Development Tools

- **Git**
- **Visual Studio Code**

## Database

The application uses PostgreSQL as its persistent data layer through Supabase.

The database stores information related to:

- users
- projects
- 3D objects
- project sharing
- generated artifacts
- application state

Row-Level Security policies are used to enforce data access restrictions at the database level.

## 3D Editor

The 3D editor represents the main working environment of the application.

Its implementation includes:

- spatial navigation
- object selection
- object manipulation
- transformation controls
- object property editing
- object parameter management
- cell model import
- simulation configuration
- scene validation
- scene export

The editor combines interactive mouse-based manipulation with exact numerical input, allowing users to switch between intuitive modeling and precise geometric definition.

## Code Generation Workflow

The general workflow is:

```text
Create / Edit 3D Scene
          │
          ▼
Configure Object Parameters
          │
          ▼
Validate Scene
          │
          ▼
Send Scene Data to API
          │
          ▼
Generate Python Simulation Code
          │
          ▼
ESPResSoMD / PyOIF
```

The generated code represents the geometry and transformations defined by the user in the visual editor.

## Testing

The completed application was tested in several areas, including:

- functional correctness
- geometric accuracy
- generated model correctness
- usability
- application performance

The thesis also contains quantitative performance evaluation and verification of generated geometries against specific simulation cases.

## Screenshots

### 3D Editor

The main workspace provides an interactive 3D environment for designing and manipulating microfluidic geometries.

![3D Editor](screenshots/3d-editor.png)

### Parametric Object Editing

Objects can be precisely configured using numerical position, dimension, rotation and geometry parameters.

![Object Editor](screenshots/object-editor.png)

### Cell Models

The application supports importing and manipulating 3D cell models within the simulation environment.

![Cell Models](screenshots/cell-models.png)

### From 3D Design to Simulation

The designed geometry can be converted into simulation code and processed by ESPResSoMD. The resulting model can then be visualized in ParaView.

![Simulation Result](screenshots/simulation-result.png)

## Bachelor's Thesis

This project was developed as part of my Bachelor's thesis:

**Interactive 3D Application for Design and Code Generation of Microfluidic Channel Models**

**Author:** Marcel Mikolášek  
**University:** University of Žilina  
**Faculty:** Faculty of Management Science and Informatics  
**Department:** Department of Software Technologies  
**Year:** 2026  
**Supervisor:** Ing. Michal Mulík, PhD.

The thesis describes the analysis, architecture, implementation and testing of the application, including the 3D editor, database design, authentication, code-generation process and performance evaluation.

**[Read the full Bachelor's thesis](thesis/MarcelMikolasek_BakalarskaPraca_final.pdf)**

## Getting Started

### Prerequisites

- Node.js
- npm
- A configured Supabase project

### Installation

```bash
git clone https://github.com/Marcelll1/microfluidic-3d-designer.git
cd microfluidic-3d-designer
npm install
```

### Environment Variables

Create a local environment configuration file:

```text
.env.local
```

Configure the environment variables required by the application.

**Do not commit `.env.local` or any secret credentials to the repository.**

### Development

```bash
npm run dev
```

The application will then be available through the local development server.

## Author

**Marcel Mikolášek**

Computer Science Graduate & Software Developer

- GitHub: [github.com/Marcelll1](https://github.com/Marcelll1)
- LinkedIn: [linkedin.com/in/marcel-mikolášek-a7096a333](https://www.linkedin.com/in/marcel-mikolášek-a7096a333/)
