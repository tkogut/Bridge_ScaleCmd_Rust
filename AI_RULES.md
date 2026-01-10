# Tech Stack

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx
- Always put source code in the src folder.
- Put pages into src/pages/
- Put components into src/components/
- The main page (default page) is src/pages/Index.tsx
- UPDATE the main page to include the new components. OTHERWISE, the user can NOT see any components!
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS: always use Tailwind CSS for styling components. Utilize Tailwind classes extensively for layout, spacing, colors, and other design aspects.

Available packages and libraries:

- The lucide-react package is installed for icons.
- You ALREADY have ALL the shadcn/ui components and their dependencies installed. So you don't need to install them again.
- You have ALL the necessary Radix UI components installed.
- Use prebuilt components from the shadcn/ui library after importing them. Note that these files shouldn't be edited, so make new components if you need to change them.

---

# ⚠️ CRITICAL BUILD INSTRUCTIONS - ALWAYS READ THIS FIRST!

## 🚨 REMEMBER: NEVER use `cargo build` directly! Always use Build-WindowsInstaller.ps1!

## 🔨 Building and Testing the Project

**IMPORTANT: To rebuild the Rust backend and create installer, ALWAYS use the build script:**

```powershell
.\scripts\Build-WindowsInstaller.ps1
```

**NEVER use direct `cargo build` or `cargo check` commands!** The build process requires:
1. MinGW toolchain setup (handled by build-rust-mingw.ps1)
2. AVG firewall handling
3. Proper environment configuration
4. Frontend build integration
5. Installer creation

### Build Process Steps:
1. **Backend (Rust):** Uses `build-rust-mingw.ps1 --release` (called by Build-WindowsInstaller.ps1)
2. **Frontend (React):** Uses `npm run build` (called by Build-WindowsInstaller.ps1)
3. **Installer:** Uses Inno Setup compiler (called by Build-WindowsInstaller.ps1)

### Quick Commands:

**Full rebuild + installer:**
```powershell
.\scripts\Build-WindowsInstaller.ps1
```

**Rebuild backend only (if you must, but prefer Build-WindowsInstaller.ps1):**
```powershell
.\build-rust-mingw.ps1 --release --skip-tests
```

**Test compilation (if needed, but be aware of MinGW/AVG issues):**
```powershell
cd src-rust
cargo check
```

**Frontend only:**
```powershell
npm run build
```

### Version Management:

**Automatic Version Incrementing:**
- When building from `main` branch: Version is automatically incremented (patch version)
  - Example: `0.1.1` → `0.1.2`
  - Cargo.toml is automatically updated with new version
  - Installer name: `ScaleCmdBridge-Setup-x64-v0.1.2.exe`

**Feature Branches:**
- When building from feature branches: Version stays the same, branch name is added
  - Example: `refactor/host-device-separation` → `ScaleCmdBridge-Setup-x64-v0.1.1-refactor-host-device-separation.exe`
  - Timestamp may be added if file already exists

---

## 🚨 Common Issues:

- **AVG blocking build:** The build script handles this automatically
- **Permission errors:** Build script resets file attributes
- **MinGW not found:** Build script checks and reports errors
- **dlltool errors:** Normal when running cargo directly - use build script instead