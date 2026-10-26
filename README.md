# 🛡️ Build the Most Secure System – Security Trade-off Game

An interactive game about the trade-off between security, risk and limited resources. The game UI is in Finnish.

You are a company's new CISO. You have a **limited budget** and pick security controls for the system. **You can't afford everything.** Then the system is hit by a **random threat scenario**, and the game shows how your choices held up and what you should have done differently.

## How to play

1. **Pick an organisation**: Startup (60 k€), Kasvuyritys / growth company (100 k€) or Pörssiyhtiö / listed company (150 k€). A bigger budget also means bigger losses.
2. **Pick controls** from 16 options (MFA, EDR, backups, SIEM, segmentation, WAF, …). Each one has
   - a **cost** that comes out of your budget, and
   - some **user friction** 😤. If friction goes over the limit, users start working around the controls and every preventive control loses effectiveness.
3. **Launch the attack.** One of 9 scenarios is drawn at random (ransomware, CEO fraud, credential stuffing, SQL injection, DDoS, insider threat, supply-chain attack, lost laptop, unpatched VPN appliance).
4. **Follow the attack** stage by stage: which controls stopped it, and which stages it got through.
5. **Results:** damage in euros, a score, the controls that would have helped most, and a **risk profile** of your build against every threat.

## Simulation model

- An attack goes through several stages. At each stage, the chance that it is stopped is `1 − Π(1 − effectiveness)` over the selected controls that apply to that stage.
- An attack that is stopped early does almost no damage. The further it gets, the higher the investigation and clean-up costs.
- If every stage is passed, there is a full breach. Detecting controls (SIEM, EDR) can halve the damage, and recovery controls (backups, incident response plan) reduce it further.
- The risk profile computes the **expected loss** analytically, so a single lucky or unlucky attack doesn't tell the whole story.

The numbers are simplified, teaching-level estimates. They are not real risk measurements.

## Running it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder as a static site (for example with GitHub Pages):

```bash
npm start   # local server at http://localhost:8080
```

## Tests

The game logic (`js/engine.js`) is separate from the UI and is tested with Node.js:

```bash
npm test
```

## Structure

| File | Contents |
| --- | --- |
| `index.html` | Game screens |
| `css/style.css` | Styles (light and dark themes, mobile layout) |
| `js/data.js` | Controls, difficulty levels and threat scenarios |
| `js/engine.js` | Attack simulation, expected loss, recommendations |
| `js/ui.js` | User interface |
| `tests/engine.test.js` | Tests for the logic |

To add a scenario or control, edit `js/data.js`. The tests check that every reference points to an existing control.
