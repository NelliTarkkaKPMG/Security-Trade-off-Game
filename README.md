# 🛡️ Build the Most Secure System – Security Trade-off Game

An awareness and discussion game about security controls, risk and limited resources. The game UI is in Finnish.

You are a company's new security lead. You get an **extra budget** and choose which security controls to invest in. **The money isn't enough for everything.** Then the company is attacked. The attack is drawn based on what realistically threatens *this kind* of company. The game shows what happened, what would have helped most, and a question for the team to discuss.

## Companies

Each company has a realistic starting point: it already has some controls, it has a known weakness, and it has its own threat landscape.

| | Software startup | Industrial company | Financial company |
| --- | --- | --- | --- |
| **Profile** | SaaS, 25 people, all in the cloud | Manufacturer, 300 people, factory + offices | Banking and insurance, 2,000 people |
| **Already has** | Email filtering | Email filtering | Email filtering, MFA, EDR, 24/7 monitoring, backups |
| **Weakness** | Everyone is an admin, nothing is written down | Old VPN appliance, flat network, two IT people | Large IT help desk, many vendors |
| **Extra budget** | 40 k€ | 70 k€ | 70 k€ |
| **Regulation** | GDPR | NIS2 | NIS2 and DORA |

Controls required by law are marked with a "Laki edellyttää" (required by law) badge, and missing ones are listed on the results screen.

## Controls (14)

MFA · email filtering · staff training · **verification procedures** (call-back checks and two-person approval for payments and account resets) · EDR · isolated backups · patch management · network segmentation · WAF · 24/7 security monitoring · access rights restriction · disk encryption · DDoS protection · incident response plan.

Some controls make everyday work harder. If you add too many at once, people start working around them and every control's effectiveness drops.

## Threat scenarios (11)

Ransomware · invoice fraud · **deepfake video call** · **phone call to the IT help desk** (MFA reset) · **cloud account takeover** (infostealer) · web service vulnerability · DDoS · insider threat · supply-chain attack · lost laptop · unpatched VPN appliance.

Each scenario only applies to companies it realistically fits (for example, a cloud-only startup has no VPN appliance and no help desk). Each one also has realistic detection times and a discussion question.

## Simulation model

- An attack goes through several stages. At each stage, the chance that it is stopped is `1 − Π(1 − effectiveness)` over the active controls that apply to that stage.
- Attackers come in three levels (basic, advanced, high-level). The bigger the company, the more advanced its attackers. The attacker's skill weakens controls (`e' = 1 − (1 − e)^(1/strength)`), and basic attackers often give up on their own.
- A control that fails to stop a stage still limits the damage. The severity of a breach varies, the speed of detection reduces the damage, and backups and the incident response plan speed up recovery.
- The result is shown on a five-level scale. The risk view shows the expected loss per attack, from the company's starting point to the player's choices.

The numbers are simplified, teaching-level estimates. They are not real risk measurements.

## Running it

No build step and no dependencies. Fonts (Chakra Petch, Barlow, JetBrains Mono) load from Google Fonts. Without a network connection, the page falls back to system fonts. Open `index.html` in a browser, or serve the folder as a static site (for example with GitHub Pages):

```bash
npm start   # local server at http://localhost:8080
```

After a change, bump the `?v=` number on the script and style links in `index.html` so browsers don't use old cached files.

## Tests

```bash
npm test
```

The tests check the game logic and the realism rules (for example, a control only works where it really works, and each company only faces threats that fit it).

## Structure

| File | Contents |
| --- | --- |
| `index.html` | Game screens |
| `css/style.css` | Styles (light and dark themes, mobile layout) |
| `js/data.js` | Controls, companies, attacker levels and scenarios |
| `js/engine.js` | Attack simulation, expected loss, recommendations |
| `js/ui.js` | User interface |
| `tests/engine.test.js` | Tests |
