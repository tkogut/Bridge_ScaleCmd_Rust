# Contribution Guidelines
**ScaleIT Bridge v3.1.0**

Thank you for your interest in contributing to ScaleIT Bridge! This document provides guidelines and instructions for contributing.

---

## 🤝 Code of Conduct

We are committed to providing a welcoming and inspiring community. Please read and follow our Code of Conduct.

All community members must treat each other with respect and professionalism.

---

## 🚀 How to Contribute

### Reporting Bugs

Before creating bug reports, check the issue list as you might find out that you don't need to create one. When you are creating a bug report, include as many details as possible:

- **Use a clear, descriptive title**
- **Describe the exact steps which reproduce the problem**
- **Provide specific examples to demonstrate those steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if possible**
- **Include your environment**: OS, Bridge version, device model

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear, descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**

### Pull Requests

- Follow the Rust styleguide
- Include appropriate test cases
- End all files with a newline
- Avoid platform-dependent code
- Document new code

---

## 📝 Development Setup

### Prerequisites
- Rust 1.70.0+
- Cargo
- Git

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/scaleit/bridge-rust.git
cd bridge-rust

# Create a feature branch
git checkout -b feature/your-feature-name

# Install dependencies
cargo build

# Run tests
cargo test

# Run clippy
cargo clippy -- -D warnings

# Format code
cargo fmt
```

---

## 🧪 Testing

### Unit Tests
```bash
cargo test --lib
```

### Integration Tests
```bash
cargo test --test '*'
```

### Coverage
```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Generate coverage report
cargo tarpaulin --out Html
```

### Manual Testing

1. Start Bridge locally
2. Configure test devices in `config/devices.json`
3. Test each command:
   - readGross
   - readNet
   - tare
   - zero

---

## 📋 Commit Messages

Use clear, descriptive commit messages:

```
feat: Add readNet command support
fix: Fix firewall configuration on Windows
docs: Update installation guide for Linux
test: Add unit tests for Rinstrum adapter
chore: Update dependencies
```

Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, dependencies, etc.

---

## 🔍 Code Style

### Rust Guidelines

Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).

### Naming Conventions

- **Functions**: `snake_case`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types**: `PascalCase`
- **Modules**: `snake_case`

### Example:

```rust
// Constants
const DEFAULT_TIMEOUT: u32 = 3000;

// Functions
fn execute_command(device_id: &str) -> Result<Response, Error> {
    // Implementation
}

// Types
pub struct WeightReading {
    pub gross_weight: f64,
    pub net_weight: f64,
}
```

---

## 📚 Documentation

### Code Comments

- Add comments for non-obvious logic
- Use `///` for public API documentation
- Provide examples in documentation comments

### Example:

```rust
/// Executes a command on the specified device
///
/// # Arguments
/// * `device_id` - The ID of the target device
/// * `command` - The command to execute (readGross, readNet, tare, zero)
///
/// # Returns
/// Returns a `Result` containing the `WeightReading` or an error
///
/// # Example
/// ```
/// let reading = execute_command("c320_line1", "readGross")?;
/// println!("Weight: {} {}", reading.gross_weight, reading.unit);
/// ```
pub async fn execute_command(device_id: &str, command: &str) -> Result<WeightReading, Error> {
    // Implementation
}
```

---

## 🔐 Security

### Security Issues

Do NOT open public GitHub issues for security vulnerabilities. Email security@scaleit.io instead.

### Security Best Practices

- Always validate user input
- Use Rust's type system for safety
- Avoid `unsafe` code unless absolutely necessary
- Keep dependencies up to date
- Run security audits: `cargo audit`

---

## 📦 Release Process

1. **Version Bumping**: Update version in `Cargo.toml`
2. **Changelog**: Update `CHANGELOG.md`
3. **Testing**: Run full test suite
4. **Build**: Create release binaries
5. **Tag**: Create git tag
6. **Release Notes**: Write GitHub release notes
7. **Announce**: Notify users and community

---

## 🎯 Priority Areas for Contribution

### High Priority
- [ ] Device adapter implementations (Dini Argeo, etc.)
- [ ] Serial communication support
- [ ] Web UI alternative to GUI Manager
- [ ] Comprehensive error handling improvements

### Medium Priority
- [ ] Performance optimizations
- [ ] Additional test coverage
- [ ] Documentation improvements
- [ ] Example integrations

### Low Priority
- [ ] UI/UX improvements to GUI Manager
- [ ] Code refactoring
- [ ] Development tooling

---

## 📖 Resources

- [Rust Documentation](https://doc.rust-lang.org/)
- [Actix-web Documentation](https://actix.rs/)
- [Tokio Documentation](https://tokio.rs/)
- [Our Architecture Doc](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)

---

## 🙏 Thank You!

Your contributions help make ScaleIT Bridge better for everyone. We appreciate your time and effort!

If you have any questions, feel free to ask in [GitHub Discussions](https://github.com/scaleit/bridge-rust/discussions).

---

**Last Updated**: November 23, 2025  
**Version**: 3.1.0