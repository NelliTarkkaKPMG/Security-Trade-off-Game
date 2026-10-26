/*
 * Pelin sisältö: tietoturvakontrollit, vaikeustasot ja uhkaskenaariot.
 *
 * Kontrollin tehokkuus (0–1) kertoo, millä todennäköisyydellä kontrolli
 * yksinään pysäyttää hyökkäyksen kyseisessä vaiheessa. Useampi kontrolli
 * samassa vaiheessa yhdistetään: P(torjunta) = 1 - Π(1 - tehokkuus).
 *
 * detection kertoo, miten ja milloin hyökkäys realistisesti huomataan tässä
 * skenaariossa. {n} korvataan luvulla väliltä min–max: nopeampi havainto
 * tarkoittaa pienempää vahinkoa.
 *
 * Skenaarion valinnainen giveUp nostaa hyökkääjän luovuttamisen todennäköisyyttä
 * (vähintään tämä per vaihe) ja giveUpText kertoo, miltä se näyttää tarinassa.
 *
 * Skenaarion likelihood on suhteellinen yleisyys ja tiers ne hyökkääjätasot,
 * joille skenaario on tyypillinen. Organisaation tierWeights kertoo, kuinka
 * todennäköisesti sitä vastaan hyökkää kunkin tason hyökkääjä.
 */
(function (root) {
  const controls = [
    {
      id: "mfa",
      name: "Monivaiheinen tunnistautuminen (MFA)",
      short: "MFA",
      icon: "🔐",
      cost: 15,
      friction: 1,
      category: "Suojaa",
      desc: "Pelkkä salasana ei riitä kirjautumiseen. Pysäyttää valtaosan tunnusvarkauksista."
    },
    {
      id: "email",
      name: "Sähköpostin suodatus",
      short: "Sähköpostisuodatin",
      icon: "📧",
      cost: 10,
      friction: 0,
      category: "Suojaa",
      desc: "Haitallisten liitteiden, linkkien ja huijausviestien automaattinen suodatus."
    },
    {
      id: "training",
      name: "Tietoturvakoulutus",
      short: "Koulutus",
      icon: "🎓",
      cost: 12,
      friction: 1,
      category: "Suojaa",
      desc: "Henkilöstö tunnistaa tietojenkalastelun ja toimii oikein poikkeustilanteissa."
    },
    {
      id: "edr",
      name: "Päätelaitesuojaus (EDR)",
      short: "EDR",
      icon: "🛡️",
      cost: 25,
      friction: 0,
      category: "Havaitse",
      desc: "Tunnistaa ja pysäyttää haitallisen toiminnan työasemilla ja palvelimilla."
    },
    {
      id: "backup",
      name: "Eristetyt varmuuskopiot",
      short: "Varmuuskopiot",
      icon: "💾",
      cost: 15,
      friction: 0,
      category: "Palauta",
      desc: "Muuttumattomat, verkosta eristetyt varmuuskopiot. Ei estä hyökkäystä, mutta nopeuttaa toipumista."
    },
    {
      id: "patch",
      name: "Päivitysten hallinta",
      short: "Päivitykset",
      icon: "🩹",
      cost: 15,
      friction: 0,
      category: "Suojaa",
      desc: "Tunnetut haavoittuvuudet paikataan järjestelmällisesti ja nopeasti."
    },
    {
      id: "segment",
      name: "Verkon segmentointi",
      short: "Segmentointi",
      icon: "🧱",
      cost: 20,
      friction: 1,
      category: "Suojaa",
      desc: "Verkko jaetaan vyöhykkeisiin, jolloin hyökkääjä ei pääse liikkumaan vapaasti."
    },
    {
      id: "waf",
      name: "Sovelluspalomuuri (WAF)",
      short: "WAF",
      icon: "🔥",
      cost: 15,
      friction: 0,
      category: "Suojaa",
      desc: "Suodattaa verkkosovelluksiin kohdistuvia hyökkäyksiä, kuten SQL-injektioita."
    },
    {
      id: "siem",
      name: "Lokien valvonta (SIEM/SOC)",
      short: "SIEM",
      icon: "📡",
      cost: 30,
      friction: 0,
      category: "Havaitse",
      desc: "Keskitetty lokien keruu ja 24/7-valvonta. Havaitsee hyökkäykset ajoissa."
    },
    {
      id: "pam",
      name: "Vähimmät oikeudet (PAM)",
      short: "Vähimmät oikeudet",
      icon: "🗝️",
      cost: 20,
      friction: 2,
      category: "Suojaa",
      desc: "Käyttäjillä on vain työhön tarvittavat oikeudet; pääkäyttäjätunnuksia valvotaan."
    },
    {
      id: "encryption",
      name: "Levyjen salaus",
      short: "Levysalaus",
      icon: "🔒",
      cost: 8,
      friction: 0,
      category: "Suojaa",
      desc: "Kannettavien ja palvelimien levyt salataan, jolloin kadonnut laite ei vuoda tietoja."
    },
    {
      id: "ddos",
      name: "Palvelunestosuojaus",
      short: "DDoS-suojaus",
      icon: "🌊",
      cost: 18,
      friction: 0,
      category: "Suojaa",
      desc: "Pilvipohjainen suodatus, joka imee itseensä hyökkäysliikenteen."
    },
    {
      id: "irplan",
      name: "Häiriötilanteiden toimintasuunnitelma",
      short: "IR-suunnitelma",
      icon: "📋",
      cost: 10,
      friction: 0,
      category: "Reagoi",
      desc: "Harjoiteltu suunnitelma siitä, kuka tekee mitä, kun jotain sattuu. Pienentää vahinkoja."
    },
    {
      id: "vendor",
      name: "Toimittajariskien hallinta",
      short: "Toimittajariskit",
      icon: "🤝",
      cost: 10,
      friction: 0,
      category: "Tunnista",
      desc: "Toimittajien tietoturvan arviointi, sopimusvaatimukset ja ohjelmistopäivitysten tarkastus."
    },
    {
      id: "allowlist",
      name: "Sovellusten sallittujen lista",
      short: "Sallittujen lista",
      icon: "✅",
      cost: 15,
      friction: 3,
      category: "Suojaa",
      desc: "Vain hyväksytyt ohjelmat voivat käynnistyä. Erittäin tehokas, mutta hankaloittaa arkea."
    },
    {
      id: "pentest",
      name: "Penetraatiotestaus",
      short: "Pentestaus",
      icon: "🕵️",
      cost: 20,
      friction: 0,
      category: "Tunnista",
      desc: "Ulkopuoliset asiantuntijat etsivät haavoittuvuudet ennen hyökkääjiä."
    }
  ];

  const difficulties = [
    {
      id: "startup",
      name: "Startup",
      icon: "🚀",
      budget: 60,
      impactScale: 0.5,
      tierWeights: { basic: 0.75, advanced: 0.22, apt: 0.03 },
      desc: "Pieni tiimi, pieni budjetti. Jokainen euro on tarkkaan mietittävä."
    },
    {
      id: "sme",
      name: "Kasvuyritys",
      icon: "🏢",
      budget: 100,
      impactScale: 1,
      tierWeights: { basic: 0.55, advanced: 0.37, apt: 0.08 },
      desc: "Vakiintunut yritys, jolla on jo paljon suojattavaa."
    },
    {
      id: "enterprise",
      name: "Pörssiyhtiö",
      icon: "🏦",
      budget: 150,
      impactScale: 2,
      tierWeights: { basic: 0.35, advanced: 0.45, apt: 0.2 },
      desc: "Isompi budjetti – mutta myös isommat menetykset, jos jotain sattuu."
    }
  ];

  /*
   * Hyökkääjien taitotasot.
   *  strength:    kontrollin tehokkuus e muuttuu muotoon 1 - (1 - e)^(1 / strength).
   *               Alle 1 = kontrollit tehoavat paremmin, yli 1 = huonommin.
   *  giveUp:      todennäköisyys, että hyökkääjä epäonnistuu tai luovuttaa
   *               itsestään kussakin vaiheessa.
   *  impactScale: kuinka suuren vahingon onnistunut hyökkäys tekee.
   */
  const attackerTiers = [
    {
      id: "basic",
      name: "Perustaso",
      icon: "🧢",
      strength: 0.6,
      giveUp: 0.2,
      impactScale: 0.5,
      desc: "Opportunistinen hyökkääjä, joka käyttää valmiita työkaluja ja siirtyy helpompaan kohteeseen, jos vastaan tulee esteitä."
    },
    {
      id: "advanced",
      name: "Edistynyt",
      icon: "🎯",
      strength: 1,
      giveUp: 0.08,
      impactScale: 1,
      desc: "Ammattimainen rikollisryhmä, joka valitsee kohteensa ja on valmis näkemään vaivaa."
    },
    {
      id: "apt",
      name: "Huipputaso (APT)",
      icon: "🕶️",
      strength: 1.7,
      giveUp: 0.02,
      impactScale: 1.6,
      desc: "Valtiollinen tai vastaava toimija, jolla on aikaa, rahaa ja omia haavoittuvuuksia. Harvinainen – mutta lähes pysäyttämätön."
    }
  ];

  // Käyttäjäkitkan raja: tämän ylittyessä käyttäjät alkavat kiertää kontrolleja.
  const frictionLimit = 4;

  const scenarios = [
    {
      id: "ransomware",
      likelihood: 3,
      tiers: ["basic", "advanced", "apt"],
      name: "Kiristyshaittaohjelma",
      icon: "💀",
      impact: 400,
      intro: "Rikollisryhmä yrittää salata yrityksen tiedostot ja vaatii lunnaita.",
      stages: [
        {
          name: "Tietojenkalastelusähköposti",
          text: "Kirjanpitäjä saa laskuksi naamioidun viestin, jonka liitteessä on haittaohjelma.",
          prevent: { email: 0.5, training: 0.35 }
        },
        {
          name: "Haittaohjelman suoritus",
          text: "Liite avataan ja haittaohjelma yrittää käynnistyä työasemalla.",
          prevent: { allowlist: 0.6, edr: 0.55, patch: 0.25 }
        },
        {
          name: "Leviäminen verkossa",
          text: "Hyökkääjä etsii pääkäyttäjätunnuksia ja leviää palvelimille.",
          prevent: { segment: 0.5, pam: 0.4, mfa: 0.2 }
        },
        {
          name: "Tiedostojen salaus",
          text: "Kiristysohjelma käynnistetään kaikilla saavutetuilla koneilla samanaikaisesti.",
          prevent: { edr: 0.3 }
        }
      ],
      detect: { siem: 0.6, edr: 0.3 },
      detection: {
        detected: { text: "Hyökkääjän liikkeet verkossa havaittiin {n} tunnissa, ja koneita ehdittiin eristää ennen kuin salaus levisi kaikkialle.", min: 1, max: 12 },
        undetected: { text: "Hyökkäys huomattiin vasta, kun tiedostot oli jo salattu ja lunnasvaatimus ilmestyi näytöille." }
      },
      recover: { backup: 0.7, irplan: 0.3 }
    },
    {
      id: "bec",
      likelihood: 3,
      tiers: ["basic", "advanced"],
      name: "Laskutuspetos",
      icon: "🎭",
      impact: 250,
      intro: "Huijari kaappaa talousosaston sähköpostitilin ja yrittää ohjata toimittajan laskun maksun omalle tililleen.",
      stages: [
        {
          name: "Tunnusten kalastelu",
          text: "Talousjohtaja saa viestin, jonka linkki vie aidolta näyttävälle Microsoft 365 -kirjautumissivulle.",
          prevent: { email: 0.45, training: 0.35 }
        },
        {
          name: "Sähköpostitilin kaappaus",
          text: "Huijari yrittää kirjautua talousjohtajan tilille kalastellulla salasanalla.",
          prevent: { mfa: 0.75 }
        },
        {
          name: "Maksuohjeen muutos",
          text: "Kaapatulta tililtä vastataan aitoon laskuketjuun ja pyydetään maksamaan uudelle tilinumerolle.",
          prevent: { training: 0.45, siem: 0.2 }
        }
      ],
      detect: { siem: 0.4 },
      detection: {
        detected: { text: "Poikkeava kirjautuminen havaittiin {n} tunnissa, ja pankkia pyydettiin pysäyttämään maksu.", min: 1, max: 24 },
        undetected: { text: "Huijaus paljastui vasta, kun oikea toimittaja kysyi maksamattoman laskun perään {n} päivän kuluttua.", min: 7, max: 30 }
      },
      recover: { irplan: 0.4 }
    },
    {
      id: "stuffing",
      likelihood: 3,
      tiers: ["basic", "advanced"],
      name: "Tunnusten täyttöhyökkäys",
      icon: "🤖",
      impact: 200,
      intro: "Bottiverkko kokeilee muualta vuotaneita salasanoja asiakasportaaliin.",
      stages: [
        {
          name: "Vuotaneiden salasanojen kokeilu",
          text: "Tuhansia kirjautumisyrityksiä minuutissa eri IP-osoitteista.",
          prevent: { mfa: 0.8, waf: 0.4, ddos: 0.15 }
        },
        {
          name: "Asiakastilien hyväksikäyttö",
          text: "Onnistuneilla tunnuksilla kirjaudutaan satoihin asiakastileihin ja kerätään henkilötietoja.",
          prevent: { siem: 0.4, waf: 0.25 }
        }
      ],
      detect: { siem: 0.5, waf: 0.2 },
      detection: {
        detected: { text: "Kirjautumispiikki havaittiin {n} tunnissa, ja kaapatut tilit lukittiin.", min: 1, max: 12 },
        undetected: { text: "Tilikaappaukset paljastuivat vasta asiakkaiden valituksista {n} päivän kuluttua.", min: 2, max: 14 }
      },
      recover: { irplan: 0.4 }
    },
    {
      id: "webapp",
      likelihood: 2,
      tiers: ["basic", "advanced", "apt"],
      name: "SQL-injektio verkkokaupassa",
      icon: "🕸️",
      impact: 300,
      intro: "Hyökkääjä etsii aukkoja verkkokaupasta päästäkseen käsiksi asiakastietokantaan.",
      stages: [
        {
          name: "Haavoittuvuuksien etsintä",
          text: "Automaattinen skanneri käy läpi verkkokaupan lomakkeet ja hakukentät.",
          prevent: { pentest: 0.5, waf: 0.4 }
        },
        {
          name: "SQL-injektio",
          text: "Hakukentän kautta syötetään tietokantakomentoja.",
          prevent: { waf: 0.5, patch: 0.3, pentest: 0.3 }
        },
        {
          name: "Asiakastietojen kopiointi",
          text: "Sovelluksen kautta luetaan asiakkaiden yhteystiedot ja salasanatiivisteet.",
          prevent: { pam: 0.4, waf: 0.2, siem: 0.2 }
        }
      ],
      detect: { siem: 0.5, waf: 0.2 },
      detection: {
        detected: { text: "Poikkeavat tietokantakyselyt havaittiin {n} tunnissa, ja haavoittuva hakukenttä suljettiin.", min: 1, max: 24 },
        undetected: { text: "Tietovuoto paljastui vasta, kun asiakastiedot ilmestyivät myyntiin rikollisfoorumille {n} päivän kuluttua.", min: 14, max: 60 }
      },
      recover: { irplan: 0.4 }
    },
    {
      id: "ddos",
      likelihood: 1.5,
      tiers: ["basic", "advanced"],
      name: "Palvelunestohyökkäys",
      icon: "🌪️",
      impact: 150,
      intro: "Hakkeriaktivistit yrittävät kaataa verkkopalvelun kesken vilkkaimman myyntikauden.",
      stages: [
        {
          name: "Liikennetulva",
          text: "Kymmeniä gigabittejä roskaliikennettä sekunnissa.",
          prevent: { ddos: 0.85, waf: 0.2 }
        },
        {
          name: "Sovellustason kuormitus",
          text: "Raskaita hakukyselyjä, jotka näyttävät oikeilta käyttäjiltä.",
          prevent: { waf: 0.4, ddos: 0.4 }
        }
      ],
      detect: { siem: 0.5 },
      detection: {
        detected: { text: "Palvelunesto tunnistettiin {n} minuutissa, ja liikenne ohjattiin suodatukseen.", min: 5, max: 30 },
        undetected: { text: "Palvelunesto tunnistettiin vasta {n} tunnin kuluttua – siihen asti vikaa etsittiin omista palvelimista.", min: 2, max: 8 }
      },
      recover: { irplan: 0.5 }
    },
    {
      id: "insider",
      likelihood: 1,
      tiers: ["basic", "advanced", "apt"],
      name: "Sisäpiirin uhka",
      icon: "🕴️",
      impact: 280,
      intro: "Irtisanoutuva työntekijä aikoo viedä asiakasrekisterin mukanaan kilpailijalle.",
      stages: [
        {
          name: "Laajojen oikeuksien hyväksikäyttö",
          text: "Työntekijällä on vuosien varrella kertyneet pääsyoikeudet lähes kaikkeen.",
          prevent: { pam: 0.6, segment: 0.2 }
        },
        {
          name: "Tietojen keruu",
          text: "Asiakasrekisteri ja tarjoukset ladataan omalle koneelle.",
          prevent: { siem: 0.35 }
        },
        {
          name: "Tietojen vienti ulos",
          text: "Tiedostot lähetetään yksityiseen sähköpostiin ja kopioidaan USB-tikulle.",
          prevent: { edr: 0.3, siem: 0.3, email: 0.15 }
        }
      ],
      detect: { siem: 0.6 },
      detection: {
        detected: { text: "Poikkeava tiedonsiirto havaittiin {n} tunnissa, ja tunnukset suljettiin.", min: 1, max: 48 },
        undetected: { text: "Tietovuoto paljastui vasta, kun asiakkaita alkoi siirtyä kilpailijalle {n} viikon kuluttua.", min: 2, max: 8 }
      },
      recover: { irplan: 0.4 }
    },
    {
      id: "supplychain",
      likelihood: 0.5,
      tiers: ["advanced", "apt"],
      name: "Toimitusketjuhyökkäys",
      icon: "📦",
      impact: 450,
      intro: "Hyökkääjä on murtautunut käyttämänne ohjelmiston toimittajan päivityspalvelimelle.",
      stages: [
        {
          name: "Saastunut päivitys",
          text: "Luotettu toimittaja jakaa aidosti allekirjoitetun päivityksen, jossa on takaovi.",
          prevent: { vendor: 0.25 }
        },
        {
          name: "Takaoven aktivoituminen",
          text: "Takaovi herää viikkojen hiljaiselon jälkeen ja alkaa tutkia ympäristöä.",
          prevent: { edr: 0.35, segment: 0.25 }
        },
        {
          name: "Komentoyhteys ulos",
          text: "Takaovi ottaa yhteyttä hyökkääjän palvelimeen ja odottaa käskyjä.",
          prevent: { segment: 0.35, siem: 0.35 }
        }
      ],
      detect: { siem: 0.5, edr: 0.3 },
      detection: {
        detected: { text: "Epäilyttävä yhteys hyökkääjän palvelimelle havaittiin {n} päivässä.", min: 1, max: 7 },
        undetected: { text: "Takaovi paljastui vasta, kun toimittaja tiedotti murrosta {n} kuukauden kuluttua.", min: 2, max: 9 }
      },
      recover: { irplan: 0.4, backup: 0.2 }
    },
    {
      id: "laptop",
      likelihood: 2,
      tiers: ["basic"],
      name: "Kadonnut kannettava",
      icon: "💻",
      impact: 120,
      intro: "Myyntipäällikön kannettava jää junaan. Laite on lukittu, mutta löytäjä yrittää silti päästä käsiksi sen tietoihin.",
      // Useimmiten löytäjä ei ole kiinnostunut tiedoista, vaan laite pyyhitään ja myydään.
      giveUp: 0.5,
      giveUpText: "Löytäjä ei ollut kiinnostunut tiedoista – laite pyyhittiin ja myytiin eteenpäin.",
      stages: [
        {
          name: "Lukituksen ohittaminen",
          text: "Kirjautumissalasana ei suojaa levyä: löytäjä irrottaa levyn tai käynnistää koneen USB-tikulta ja lukee tiedostot suoraan.",
          prevent: { encryption: 0.9 }
        },
        {
          name: "Kirjautuminen pilvipalveluihin",
          text: "Levyltä löytyy selaimeen tallennettuja salasanoja, joilla yritetään kirjautua yrityksen sähköpostiin ja pilvipalveluihin.",
          prevent: { mfa: 0.8 }
        }
      ],
      detect: { siem: 0.3 },
      detection: {
        detected: { text: "Kirjautuminen tuntemattomalta laitteelta havaittiin {n} tunnissa, ja tunnukset suljettiin.", min: 1, max: 6 },
        undetected: { text: "Tunnukset suljettiin vasta, kun myyntipäällikkö ilmoitti laitteen kadonneeksi {n} päivän kuluttua.", min: 1, max: 3 }
      },
      recover: { irplan: 0.3 }
    },
    {
      id: "vpn",
      likelihood: 2,
      tiers: ["basic", "advanced", "apt"],
      name: "Paikkaamaton VPN-laite",
      icon: "🚪",
      impact: 350,
      intro: "VPN-laitteesta on julkaistu kriittinen haavoittuvuus – ja hyökkääjät skannaavat koko internetiä.",
      stages: [
        {
          name: "Haavoittuvuuden hyväksikäyttö",
          text: "Automaattinen työkalu löytää yrityksen VPN-laitteen ja kokeilee julkaistua hyökkäyskoodia.",
          prevent: { patch: 0.7, pentest: 0.3 }
        },
        {
          name: "Tunnusten keruu",
          text: "Hyökkääjä kerää laitteelta VPN-käyttäjien salasanoja.",
          prevent: { mfa: 0.5 }
        },
        {
          name: "Pääsy sisäverkkoon",
          text: "VPN-laitteelta siirrytään sisäverkon palvelimille.",
          prevent: { segment: 0.5, pam: 0.3, edr: 0.3 }
        }
      ],
      detect: { siem: 0.5, edr: 0.2 },
      detection: {
        detected: { text: "Poikkeava toiminta VPN-laitteella havaittiin {n} tunnissa.", min: 1, max: 24 },
        undetected: { text: "Murto paljastui vasta, kun Kyberturvallisuuskeskus ilmoitti siitä {n} päivän kuluttua.", min: 5, max: 30 }
      },
      recover: { backup: 0.3, irplan: 0.35 }
    }
  ];

  const data = { controls, difficulties, attackerTiers, scenarios, frictionLimit };

  if (typeof module === "object" && module.exports) {
    module.exports = data;
  } else {
    root.GameData = data;
  }
})(this);
