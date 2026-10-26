/*
 * Pelin sisältö: tietoturvakontrollit, vaikeustasot ja uhkaskenaariot.
 *
 * Kontrollin tehokkuus (0–1) kertoo, millä todennäköisyydellä kontrolli
 * yksinään pysäyttää hyökkäyksen kyseisessä vaiheessa. Useampi kontrolli
 * samassa vaiheessa yhdistetään: P(torjunta) = 1 - Π(1 - tehokkuus).
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
      desc: "Pieni tiimi, pieni budjetti. Jokainen euro on tarkkaan mietittävä."
    },
    {
      id: "sme",
      name: "Kasvuyritys",
      icon: "🏢",
      budget: 100,
      impactScale: 1,
      desc: "Vakiintunut yritys, jolla on jo paljon suojattavaa."
    },
    {
      id: "enterprise",
      name: "Pörssiyhtiö",
      icon: "🏦",
      budget: 150,
      impactScale: 2,
      desc: "Isompi budjetti – mutta myös isommat menetykset, jos jotain sattuu."
    }
  ];

  // Käyttäjäkitkan raja: tämän ylittyessä käyttäjät alkavat kiertää kontrolleja.
  const frictionLimit = 4;

  const scenarios = [
    {
      id: "ransomware",
      name: "Kiristyshaittaohjelma",
      icon: "💀",
      impact: 400,
      intro: "Rikollisryhmä yrittää salata yrityksen kaikki tiedostot ja vaatii lunnaita.",
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
          text: "Kiristysohjelma käynnistetään kaikilla koneilla samanaikaisesti.",
          prevent: { edr: 0.3 }
        }
      ],
      detect: { siem: 0.6, edr: 0.3 },
      recover: { backup: 0.7, irplan: 0.3 }
    },
    {
      id: "bec",
      name: "Toimitusjohtajahuijaus",
      icon: "🎭",
      impact: 250,
      intro: "Huijari esiintyy toimitusjohtajana ja yrittää saada talousosaston maksamaan väärälle tilille.",
      stages: [
        {
          name: "Huijausviesti",
          text: "Talousjohtaja saa kiireellisen viestin 'toimitusjohtajalta'.",
          prevent: { email: 0.45, training: 0.3 }
        },
        {
          name: "Tunnusten kalastelu",
          text: "Viestin linkki vie aidolta näyttävälle kirjautumissivulle.",
          prevent: { mfa: 0.7, training: 0.3 }
        },
        {
          name: "Maksuohjeen muutos",
          text: "Kaapatulla tilillä pyydetään muuttamaan toimittajan tilinumero.",
          prevent: { training: 0.4, siem: 0.2 }
        }
      ],
      detect: { siem: 0.4 },
      recover: { irplan: 0.4 }
    },
    {
      id: "stuffing",
      name: "Tunnusten täyttöhyökkäys",
      icon: "🤖",
      impact: 200,
      intro: "Bottiverkko kokeilee miljoonia muualta vuotaneita salasanoja asiakasportaaliin.",
      stages: [
        {
          name: "Vuotaneiden salasanojen kokeilu",
          text: "Tuhannet kirjautumisyritykset sekunnissa eri IP-osoitteista.",
          prevent: { mfa: 0.8, waf: 0.4, ddos: 0.2 }
        },
        {
          name: "Tilien kaappaus",
          text: "Onnistuneilla tunnuksilla haetaan asiakkaiden henkilötietoja.",
          prevent: { pam: 0.3, siem: 0.3 }
        }
      ],
      detect: { siem: 0.5, waf: 0.2 },
      recover: { irplan: 0.4 }
    },
    {
      id: "webapp",
      name: "SQL-injektio verkkokaupassa",
      icon: "🕸️",
      impact: 300,
      intro: "Hyökkääjä etsii aukkoja verkkokaupasta päästäkseen käsiksi asiakastietokantaan.",
      stages: [
        {
          name: "Haavoittuvuuksien etsintä",
          text: "Automaattinen skanneri käy läpi kaikki verkkokaupan lomakkeet.",
          prevent: { pentest: 0.5, waf: 0.4 }
        },
        {
          name: "SQL-injektio",
          text: "Hakukentän kautta syötetään tietokantakomentoja.",
          prevent: { waf: 0.5, patch: 0.3, pentest: 0.3 }
        },
        {
          name: "Tietokannan tyhjennys",
          text: "Asiakastiedot ja maksukorttien tiedot kopioidaan ulos.",
          prevent: { pam: 0.35, segment: 0.3, encryption: 0.2 }
        }
      ],
      detect: { siem: 0.5, waf: 0.2 },
      recover: { irplan: 0.4, backup: 0.1 }
    },
    {
      id: "ddos",
      name: "Palvelunestohyökkäys",
      icon: "🌪️",
      impact: 150,
      intro: "Hakkeriaktivistit yrittävät kaataa verkkopalvelun kesken vilkkaimman myyntikauden.",
      stages: [
        {
          name: "Liikennetulva",
          text: "Satoja gigabittejä roskaliikennettä sekunnissa.",
          prevent: { ddos: 0.85, waf: 0.2 }
        },
        {
          name: "Sovellustason kuormitus",
          text: "Raskaita hakukyselyjä, jotka näyttävät oikeilta käyttäjiltä.",
          prevent: { waf: 0.4, ddos: 0.4 }
        }
      ],
      detect: { siem: 0.3 },
      recover: { irplan: 0.5 }
    },
    {
      id: "insider",
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
          text: "Asiakasrekisteri ja tarjoukset ladataan yksi kerrallaan omalle koneelle.",
          prevent: { siem: 0.35, encryption: 0.1 }
        },
        {
          name: "Tietojen vienti ulos",
          text: "Tiedostot lähetetään yksityiseen sähköpostiin ja USB-tikulle.",
          prevent: { edr: 0.3, siem: 0.3, email: 0.2 }
        }
      ],
      detect: { siem: 0.6 },
      recover: { irplan: 0.4 }
    },
    {
      id: "supplychain",
      name: "Toimitusketjuhyökkäys",
      icon: "📦",
      impact: 450,
      intro: "Valtiollinen toimija on murtautunut käyttämänne ohjelmiston toimittajan päivityspalvelimelle.",
      stages: [
        {
          name: "Saastunut päivitys",
          text: "Luotettu toimittaja jakaa allekirjoitetun päivityksen, jossa on takaovi.",
          prevent: { vendor: 0.45, allowlist: 0.2 }
        },
        {
          name: "Takaoven aktivoituminen",
          text: "Takaovi herää viikkojen hiljaiselon jälkeen.",
          prevent: { edr: 0.45, segment: 0.25 }
        },
        {
          name: "Komentoyhteys ulos",
          text: "Takaovi ottaa yhteyttä hyökkääjän palvelimeen ja odottaa käskyjä.",
          prevent: { segment: 0.35, siem: 0.35 }
        }
      ],
      detect: { siem: 0.5, edr: 0.3 },
      recover: { irplan: 0.4, backup: 0.3 }
    },
    {
      id: "laptop",
      name: "Kadonnut kannettava",
      icon: "💻",
      impact: 120,
      intro: "Myyntipäällikön kannettava jää junaan – ja päätyy vääriin käsiin.",
      stages: [
        {
          name: "Laite katoaa",
          text: "Kiireinen päivä, laukku jää istuimelle.",
          prevent: { training: 0.15 }
        },
        {
          name: "Levyn lukeminen",
          text: "Löytäjä irrottaa levyn ja yrittää lukea sen toisella koneella.",
          prevent: { encryption: 0.9 }
        },
        {
          name: "Tallennettujen tunnusten käyttö",
          text: "Selaimeen tallennetuilla tunnuksilla kirjaudutaan pilvipalveluihin.",
          prevent: { mfa: 0.6, pam: 0.2 }
        }
      ],
      detect: { siem: 0.2 },
      recover: { backup: 0.4, irplan: 0.3 }
    },
    {
      id: "vpn",
      name: "Paikkaamaton VPN-laite",
      icon: "🚪",
      impact: 350,
      intro: "VPN-laitteesta on julkaistu kriittinen haavoittuvuus – ja hyökkääjät skannaavat koko internetiä.",
      stages: [
        {
          name: "Haavoittuvuuden skannaus",
          text: "Automaattinen työkalu löytää yrityksen VPN-laitteen.",
          prevent: { patch: 0.7, pentest: 0.3 }
        },
        {
          name: "Etäkoodin suoritus",
          text: "Haavoittuvuuden kautta hyökkääjä saa komentorivin laitteelle.",
          prevent: { edr: 0.35, allowlist: 0.3 }
        },
        {
          name: "Pääsy sisäverkkoon",
          text: "VPN-laitteelta hypätään suoraan sisäverkon palvelimille.",
          prevent: { segment: 0.5, pam: 0.3, mfa: 0.25 }
        }
      ],
      detect: { siem: 0.5 },
      recover: { backup: 0.3, irplan: 0.35 }
    }
  ];

  const data = { controls, difficulties, scenarios, frictionLimit };

  if (typeof module === "object" && module.exports) {
    module.exports = data;
  } else {
    root.GameData = data;
  }
})(this);
