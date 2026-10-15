# Security

Report a vulnerability privately with **Report a vulnerability** on the repository's [Security tab](https://github.com/mattbaconz/sloplint/security), not in a public issue. Include the version, the command or input that triggers it and what an attacker gains.

sloplint reads the files it lints and never executes them or sends anything over the network. The Claude Code hook reads a JSON payload on stdin and only reads files inside the project directory. Reports about those boundaries are especially welcome.

Fixes ship in the latest release only.
