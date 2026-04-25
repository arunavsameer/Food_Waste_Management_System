<p align="center">
  <img src="/public/icon.svg" alt="EcoPlate Logo" width="120"/>
</p>

<h1 align="center">EcoPlate</h1>
<p align="center">A Food Waste Management and Stakeholder Co-ordination Portal</p>

---

## Overview

EcoPlate is a web-based platform designed to streamline food waste management and facilitate coordination between students, caterers, and administrators. The system provides role-based access to help stakeholders track, report, and reduce food waste effectively.

---

## Tech Stack

- **Frontend** — React with Vite
- **Backend** — Supabase (PostgreSQL + Edge Functions)
- **AI Features** — Gemini API via Supabase Edge Functions (PDF parsing)

---

## Getting Started

Follow the setup instructions for your operating system below.

---

## Linux (Ubuntu and Arch)

### Step 1 — Install Git, Node.js, and npm

**Ubuntu / Debian:**

```bash
sudo apt update
sudo apt install git nodejs npm -y
```

**Arch Linux:**

```bash
sudo pacman -Syu git nodejs npm
```

Verify the installations:

```bash
git --version
node --version
npm --version
```

### Step 2 — Clone the repository and install dependencies

```bash
git clone https://github.com/arunavsameer/Food_Waste_Management_System.git
cd Food_Waste_Management
npm install
```

### Step 3 — Create and configure the .env file

```bash
echo "VITE_SUPABASE_URL= \"YOUR_SUPABASE_URL\"\nVITE_SUPABASE_ANON_KEY= \"YOUR_SUPABASE_ANON_KEY\"" > .env
```

### Step 4 — Start the development server

```bash
npm run dev
```

> Click on the localhost link provided in the terminal to open the project.

---

## macOS

### Step 1 — Install Homebrew (skip if already installed)

> Homebrew is a package manager for macOS that makes installing developer tools straightforward.

Open Terminal and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> The installer may prompt for your system password and may also install Xcode Command Line Tools if not already present — allow it to do so.

Verify Homebrew is working:

```bash
brew --version
```

> **Apple Silicon Macs (M1/M2/M3):** Homebrew installs to `/opt/homebrew` instead of `/usr/local`. If the `brew` command is not recognized after installation, run the following to add it to your PATH:
>
> ```bash
> echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
> eval "$(/opt/homebrew/bin/brew shellenv)"
> ```

### Step 2 — Install Git, Node.js, and npm (skip if already installed, just verify once)

> npm is bundled with Node.js, so one command installs both.

```bash
brew install git node
```

Verify the installations:

```bash
git --version
node --version
npm --version
```

### Step 3 — Clone the repository and install dependencies

```bash
git clone https://github.com/arunavsameer/Food_Waste_Management_System.git
cd Food_Waste_Management
npm install
```

### Step 4 — Create and configure the .env file

```bash
echo "VITE_SUPABASE_URL= \"YOUR_SUPABASE_URL\"\nVITE_SUPABASE_ANON_KEY= \"YOUR_SUPABASE_ANON_KEY\"" > .env
```

### Step 5 — Start the development server

```bash
npm run dev
```

> Click on the localhost link provided in the terminal to open the project.

---

## Windows

### Step 1 — Install Git, Node.js, and npm

> **Git** — Download and install from [git-scm.com/download/win](https://git-scm.com/download/win). Use the default installer options.
>
> **Node.js and npm** — Download the LTS installer from [nodejs.org](https://nodejs.org). npm is included with the Node.js installation.

After installing, open a new Command Prompt or PowerShell window and verify:

```bash
git --version
node --version
npm --version
```

> Make sure to open a new terminal window after installing so the PATH changes take effect.

### Step 2 — Clone the repository and install dependencies

```bash
git clone https://github.com/arunavsameer/Food_Waste_Management_System.git
cd Food_Waste_Management
npm install
```

### Step 3 — Create and configure the .env file

```bash
echo VITE_SUPABASE_URL= \"YOUR_SUPABASE_URL\"\nVITE_SUPABASE_ANON_KEY= \"YOUR_SUPABASE_ANON_KEY\" > .env
```

### Step 4 — Start the development server

```bash
npm run dev
```

> Click on the localhost link provided in the terminal to open the project.

---

## Backend Developer Setup (Supabase Edge Functions)

> Only follow these steps if you plan to edit or deploy the AI PDF parsing backend (Edge Functions). If you are only working on the React frontend, the standard setup above is all you need.

### Step 1 — Log in to the Supabase CLI

```bash
npx supabase login
```

> This will open your browser to authorize your terminal.

### Step 2 — Initialize and link the project

```bash
npx supabase init
npx supabase link --project-ref qpnuiyqefwvtsiahrpuh
```

> It will ask for your database password here.

### Step 3 — Sync cloud secrets (optional, for local testing)

```bash
npx supabase secrets download --project-ref qpnuiyqefwvtsiahrpuh
```

> This securely downloads the `GEMINI_API_KEY` from the cloud to a hidden local file so you can test Edge Functions on your machine.

---

## Testing Accounts

Use the following credentials to test the application. The password for all accounts is `123456`.

| Role    | Email                |
|---------|----------------------|
| Student | sheela1@student.com  |
| Student | sheela2@student.com  |
| Student | arora1@student.com   |
| Student | arora2@student.com   |
| Caterer | sheela@caterer.com   |
| Caterer | arora@caterer.com    |
| Admin   | test1@admin.com      |
| Admin   | test2@admin.com      |

Go ahead and use any of these accounts to try out the features. Refer to the documentation sent along with this file for details on all available features.

---

## Repository

[github.com/arunavsameer/Food_Waste_Management_System](https://github.com/arunavsameer/Food_Waste_Management_System)
