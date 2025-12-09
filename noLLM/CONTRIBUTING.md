# Contributing to SwimLanes

First off, thank you for considering contributing to SwimLanes! It's people like you that make SwimLanes such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [SwimLanes Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem
* **Describe the exact steps which reproduce the problem** in as many details as possible
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs** if possible
* **Include browser console errors** if any
* **Include your environment details** (browser, OS, version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the issue to identify the suggestion
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior** and **explain which behavior you expected to see instead**
* **Include screenshots and animated GIFs** if applicable
* **Explain why this enhancement would be useful**

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these `beginner` and `help-wanted` issues:

* [Beginner issues](https://github.com/rp4/swimlanes/labels/beginner) - issues which should only require a few lines of code
* [Help wanted issues](https://github.com/rp4/swimlanes/labels/help%20wanted) - issues which should be a bit more involved

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

* Node.js >= 16.0.0
* npm >= 8.0.0
* Git

### Installation

1. Fork and clone the repository:
```bash
git clone https://github.com/rp4/swimlanes.git
cd swimlanes
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

### Project Structure

```
swimlanes/
├── src/
│   ├── components/     # UI components
│   ├── core/           # Business logic
│   ├── lib/            # External integrations
│   └── styles/         # Styling
├── tests/              # Test files
├── docs/               # Documentation
└── examples/           # Example files
```

### Development Workflow

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and test them:
```bash
npm run dev          # Start dev server
npm test            # Run tests
npm run lint        # Check linting
npm run type-check  # Check TypeScript
```

3. Commit your changes:
```bash
git add .
git commit -m "feat: add amazing feature"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:
* `feat:` New feature
* `fix:` Bug fix
* `docs:` Documentation changes
* `style:` Code style changes (formatting, etc)
* `refactor:` Code refactoring
* `test:` Test changes
* `chore:` Build process or auxiliary tool changes

4. Push to your fork:
```bash
git push origin feature/your-feature-name
```

5. Open a Pull Request

### Testing

We use Jest for unit testing and Playwright for E2E testing:

```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run test:e2e        # Run E2E tests
```

Writing tests:
* Place unit tests next to the code they test
* Use `.test.ts` or `.spec.ts` suffix
* Write descriptive test names
* Aim for >80% code coverage

### Code Style

We use ESLint and Prettier for code formatting:

```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
npm run format      # Format code with Prettier
```

Key style guidelines:
* Use TypeScript for type safety
* Follow functional programming principles where appropriate
* Keep functions small and focused
* Write self-documenting code with clear names
* Add JSDoc comments for public APIs

### Documentation

* Update README.md if needed
* Add JSDoc comments for public functions
* Update API documentation for new features
* Include examples for complex features

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:
```
feat: add export to PDF functionality
fix: resolve connection line rendering issue
docs: update installation instructions
```

## Release Process

We use semantic versioning and automated releases:

1. Merge PRs to `main` branch
2. CI automatically determines version based on commits
3. Creates GitHub release and npm package
4. Updates CHANGELOG.md

## Community

* [GitHub Discussions](https://github.com/rp4/swimlanes/discussions) - For questions and discussions
* [Issue Tracker](https://github.com/rp4/swimlanes/issues) - For bugs and feature requests
* [Discord Server](https://discord.gg/swimlanes) - For real-time chat

## Recognition

Contributors will be recognized in:
* README.md contributors section
* GitHub contributors page
* Release notes

## Questions?

Feel free to open an issue with the `question` label or start a discussion in GitHub Discussions.

Thank you for contributing! 🏊‍♀️