# 🛡️ Build the Most Secure System – Security Trade-off Game

An interactive game about the trade-off between security, risk and limited resources. The game UI is in Finnish.

You are a company's new CISO. You have a **limited budget** and pick security controls for the system. **You can't afford everything.** Then the system is hit by a **random threat scenario**, and the game shows how your choices held up and what you should have done differently.

## How to play

1. **Pick an organisation**: Startup (60 k€), Kasvuyritys / growth company (100 k€) or Pörssiyhtiö / listed company (150 k€). A bigger budget also means bigger losses.
2. **Pick controls** from 16 options (MFA, EDR, backups, SIEM, segmentation, WAF, …). Each one has
   - a **cost** that comes out of your budget, and
   - some **user friction** 😤. If friction goes over the limit, users start working around the controls and every preventive control loses effectiveness.
3. **Launch the attack.** The threat is drawn **based on company size**:
   - first the attacker's skill level, then one of 9 scenarios (ransomware, CEO fraud, credential stuffing, SQL injection, DDoS, insider threat, supply-chain attack, lost laptop, unpatched VPN appliance), weighted by how common each one is.
   - Each scenario only occurs at the attacker levels typical for it. For example, a supply-chain attack is never basic-level, and a lost laptop is always basic-level.

   | Attacker | Startup | Growth company | Listed company | Characteristics |
   | --- | --- | --- | --- | --- |
   | 🧢 Basic | 75 % | 55 % | 35 % | Automated and opportunistic, often fails on its own, smaller damage |
   | 🎯 Advanced | 22 % | 37 % | 45 % | Professional criminal group |
   | 🕶️ High-level (APT) | 3 % | 8 % | 20 % | Rare, weakens controls significantly, large damage |

4. **Follow the attack** stage by stage: which controls stopped it, and which stages it got through.
5. **Results:** damage in euros, a score, the controls that would have helped most, and a **risk profile** of your build against every threat.

## Simulation model

- An attack goes through several stages. At each stage, the chance that it is stopped is `1 − Π(1 − effectiveness)` over the selected controls that apply to that stage.
- The attacker's skill changes how effective the controls are: `e' = 1 − (1 − e)^(1/strength)`. Against a basic attacker (strength 0.6) a control works better, and against an APT (1.7) it works clearly worse.
- An attacker can also **fail or give up on their own** at each stage (basic 20 %, advanced 8 %, APT 2 %). So an attack does not always get through, even against an undefended system: roughly 40 % of attacks on a startup with no controls fail.
- An attack that is stopped early does almost no damage. The further it gets, the higher the investigation and clean-up costs.
- If every stage is passed, there is a full breach. Detecting controls (SIEM, EDR) can halve the damage, and recovery controls (backups, incident response plan) reduce it further.
- The risk profile computes the **expected loss** analytically against the organisation's actual threat landscape, weighted by the probability of each scenario and attacker level, and compares it with the situation without any controls.

Typical outcomes (share of attacks that lead to a breach):

| | No controls | Average build | Best build |
| --- | --- | --- | --- |
| Startup | 60 % | 32 % | 18 % |
| Growth company | 66 % | 24 % | 12 % |
| Listed company | 73 % | 19 % | 11 % |

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
