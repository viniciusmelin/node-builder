<div align="center">
  <h1>⚡ Synthetix Configurator ⚡</h1>
  <p><strong>Interactive Next.js configurator for Node.js and NestJS service scaffolds.</strong></p>
  
  <p>
    <a href="https://github.com/viniciusmelin/node-builder/actions"><img src="https://img.shields.io/github/actions/workflow/status/viniciusmelin/node-builder/test.yml?branch=master&label=Tests&style=flat-square" alt="Test Status"></a>
    <a href="https://github.com/viniciusmelin/node-builder/releases"><img src="https://img.shields.io/github/package-json/v/viniciusmelin/node-builder?style=flat-square&color=blue" alt="Version"></a>
    <a href="https://github.com/viniciusmelin/node-builder/blob/master/LICENSE"><img src="https://img.shields.io/github/license/viniciusmelin/node-builder?style=flat-square" alt="License"></a>
    <img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js" alt="Next.js">
    <img src="https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript" alt="TypeScript">
  </p>
</div>

---

## 💡 The Idea

**Synthetix Configurator** was built with a clear mission: to eliminate the repetitive boilerplate setup when starting new backend projects. Whether you are building a lightweight Node.js API or a complex NestJS microservice, this tool allows you to interactively configure your stack and instantly generate production-ready code.

Our goal is to make this project **publicly available** and **host it online**, so developers from all around the world can access it, speed up their workflows, and build better software faster. 

---

## 🚀 Features

- **Interactive Configuration:** Seamlessly pick and choose your stack, database, and plugins.
- **Real-time Preview:** See exactly what files are being generated and preview their code before downloading.
- **Smart Validation:** The system ensures that your selections (frameworks, APIs, Node versions) are fully compatible.
- **Instant Download:** Get a complete `.zip` artifact containing source code, configurations, CI/CD workflows, Dockerfiles, and `synthetix.config.json`.
- **Advanced Ecosystem:** Support for Redis, Kafka, gRPC, WebSockets, Stripe, BullMQ, pnpm monorepos, and AWS Serverless templates.
- **Production Ready:** Pre-configured with observability (OpenTelemetry, Sentry, Datadog), security presets, and database lifecycles (PostgreSQL, MySQL, MongoDB).

---

## 💻 Getting Started (Local Development)

Want to run the configurator locally? Follow these steps:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

### Quality Checks
```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

---

## 🌍 Hosting & Public Release

This project is open-source and intended to be a community resource! The plan is to host a live version of this configurator so anyone can use it without needing to run it locally. 

If you are a developer looking for a fast, reliable way to bootstrap Node.js and NestJS applications, this tool is for you!

---

## 💖 Support the Project

Building and maintaining open-source software takes time, effort, and hosting costs. If this tool saves you hours of setup time and you want to support its ongoing development, please consider making a donation!

Your support helps pay for server costs, domain renewals, and fuels further feature development.

*Donation links coming soon! (Patreon / Buy Me a Coffee / GitHub Sponsors)*

---

## 🤝 Contributing

Contributions are always welcome! Feel free to open an issue, submit a pull request, or suggest new features to make the scaffolding process even better.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more information.
