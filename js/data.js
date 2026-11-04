/*
 * Pelin sisältö: tietoturvakontrollit, yritykset, hyökkääjätasot ja uhkaskenaariot.
 *
 * Kontrollin tehokkuus (0–1) kertoo, millä todennäköisyydellä kontrolli
 * yksinään pysäyttää hyökkäyksen kyseisessä vaiheessa. Useampi kontrolli
 * samassa vaiheessa yhdistetään: P(torjunta) = 1 - Π(1 - tehokkuus).
 *
 * Skenaarion likelihood on suhteellinen yleisyys ja tiers ne hyökkääjätasot,
 * joille skenaario on tyypillinen. Yrityksen scenarioWeights kertoo, kuinka
 * paljon yleisempi (tai harvinaisempi, 0 = ei koske) skenaario on juuri
 * tälle yritykselle, ja tierWeights, millaiset hyökkääjät sitä uhkaavat.
 *
 * detection kertoo, miten ja milloin hyökkäys realistisesti huomataan tässä
 * skenaariossa. {n} korvataan luvulla väliltä min–max: nopeampi havainto
 * tarkoittaa pienempää vahinkoa.
 *
 * Skenaarion valinnainen giveUp nostaa hyökkääjän luovuttamisen todennäköisyyttä
 * (vähintään tämä per vaihe) ja giveUpText kertoo, miltä se näyttää tarinassa.
 */
(function (root) {
  const controls = [
    {
      id: "mfa",
      rooms: ["aula", "pilvi"],
      name: "Monivaiheinen tunnistautuminen (MFA)",
      short: "MFA",
      icon: "🔐",
      cost: 15,
      friction: 1,
      category: "Estää",
      desc: "Pelkkä salasana ei riitä kirjautumiseen. Pysäyttää suurimman osan varastetuilla salasanoilla tehdyistä murroista."
    },
    {
      id: "email",
      rooms: ["posti"],
      name: "Sähköpostin suodatus",
      short: "Sähköpostisuodatus",
      icon: "📧",
      cost: 10,
      friction: 0,
      category: "Estää",
      desc: "Haitalliset liitteet, linkit ja huijausviestit suodatetaan ennen kuin ne päätyvät postilaatikkoon."
    },
    {
      id: "training",
      rooms: ["konttori"],
      name: "Henkilöstön koulutus",
      short: "Koulutus",
      icon: "🎓",
      cost: 12,
      friction: 1,
      category: "Estää",
      desc: "Lyhyitä koulutuksia ja harjoituksia: huijaukset tunnistetaan ja epäilyttävästä ilmoitetaan."
    },
    {
      id: "verify",
      rooms: ["talous", "ittuki"],
      name: "Varmistuskäytännöt",
      short: "Varmistukset",
      icon: "📞",
      cost: 8,
      friction: 1,
      category: "Estää",
      desc: "Tilinumeron muutokset ja tunnusten nollaukset varmistetaan soittamalla tuttuun numeroon. Isot maksut hyväksyy kaksi ihmistä."
    },
    {
      id: "edr",
      rooms: ["konttori"],
      name: "Laitteiden suojausohjelmisto (EDR)",
      short: "EDR",
      icon: "🛡️",
      cost: 25,
      friction: 0,
      category: "Havaitsee",
      desc: "Tunnistaa ja pysäyttää haittaohjelmat ja epäilyttävän toiminnan työasemilla ja palvelimilla."
    },
    {
      id: "backup",
      rooms: ["palvelin"],
      name: "Eristetyt varmuuskopiot",
      short: "Varmuuskopiot",
      icon: "💾",
      cost: 15,
      friction: 0,
      category: "Toipuu",
      desc: "Varmuuskopiot, joita hyökkääjä ei pääse muuttamaan tai poistamaan. Ei estä hyökkäystä, mutta nopeuttaa toipumista."
    },
    {
      id: "patch",
      rooms: ["vpn", "kauppa"],
      name: "Päivitysten hallinta",
      short: "Päivitykset",
      icon: "🩹",
      cost: 15,
      friction: 0,
      category: "Estää",
      desc: "Tunnetut haavoittuvuudet paikataan nopeasti – erityisesti internetiin näkyvät laitteet."
    },
    {
      id: "segment",
      rooms: ["palvelin"],
      name: "Verkon segmentointi",
      short: "Segmentointi",
      icon: "🧱",
      cost: 20,
      friction: 1,
      category: "Estää",
      desc: "Verkko jaetaan osiin, jolloin hyökkääjä ei pääse liikkumaan vapaasti koneelta toiselle."
    },
    {
      id: "waf",
      rooms: ["kauppa"],
      name: "Verkkopalvelun suojaus (WAF)",
      short: "WAF",
      icon: "🔥",
      cost: 15,
      friction: 0,
      category: "Estää",
      desc: "Suodattaa verkkopalveluun kohdistuvat hyökkäykset ja bottiliikenteen."
    },
    {
      id: "siem",
      rooms: ["valvomo"],
      name: "Tietoturvavalvonta 24/7",
      short: "Valvonta",
      icon: "📡",
      cost: 30,
      friction: 0,
      category: "Havaitsee",
      desc: "Ulkoistettu valvomo seuraa lokeja ympäri vuorokauden ja hälyttää poikkeamista."
    },
    {
      id: "pam",
      rooms: ["palvelin"],
      name: "Käyttöoikeuksien rajaus",
      short: "Oikeuksien rajaus",
      icon: "🗝️",
      cost: 20,
      friction: 2,
      category: "Estää",
      desc: "Jokaisella on vain työhön tarvittavat oikeudet, ja pääkäyttäjätunnuksia käytetään vain tarvittaessa."
    },
    {
      id: "encryption",
      rooms: ["konttori"],
      name: "Levysalaus",
      short: "Levysalaus",
      icon: "🔒",
      cost: 8,
      friction: 0,
      category: "Estää",
      desc: "Kannettavien levyt salataan, jolloin kadonnut laite ei vuoda tietoja."
    },
    {
      id: "ddos",
      rooms: ["kauppa"],
      name: "Palvelunestosuojaus",
      short: "DDoS-suojaus",
      icon: "🌊",
      cost: 18,
      friction: 0,
      category: "Estää",
      desc: "Pilvipalvelu suodattaa hyökkäysliikenteen ennen kuin se kaataa verkkopalvelun."
    },
    {
      id: "irplan",
      rooms: ["kriisi"],
      name: "Häiriötilannesuunnitelma",
      short: "Häiriösuunnitelma",
      icon: "📋",
      cost: 10,
      friction: 0,
      category: "Toipuu",
      desc: "Harjoiteltu suunnitelma: kuka päättää, keneen soitetaan ja mitä tehdään ensin. Pienentää kaikkia vahinkoja."
    }
  ];

  /*
   * Yritykset. Budjetti on tämän vuoden lisäinvestointi. owned = kontrollit,
   * jotka yrityksellä on jo (maksuttomia, aina päällä). required = kontrollit,
   * joita laki edellyttää (NIS2-pohjainen kyberturvallisuuslaki ja finanssialalla DORA).
   */
  const difficulties = [
    {
      id: "startup",
      name: "Ohjelmistostartup",
      icon: "🚀",
      sector: "SaaS-palvelu, 25 henkeä, kaikki pilvessä",
      desc: "Kasvu on ollut nopeaa: kaikilla on pääkäyttäjäoikeudet, eikä mitään ole sovittu kirjallisesti.",
      budget: 40,
      impactScale: 0.5,
      owned: ["email"],
      required: [],
      regulation: "GDPR",
      tierWeights: { basic: 0.75, advanced: 0.22, apt: 0.03 },
      scenarioWeights: {
        cloud: 2,
        bec: 1.5,
        webapp: 1.5,
        laptop: 1,
        ransomware: 0.5,
        ddos: 0.5,
        insider: 0.5,
        supplychain: 0.5,
        deepfake: 0.5,
        helpdesk: 0,
        vpn: 0
      }
    },
    {
      id: "sme",
      name: "Teollisuusyritys",
      icon: "🏭",
      sector: "Valmistaja, 300 henkeä, tehdas ja toimistot",
      desc: "IT:stä vastaa kaksi ihmistä. Etäyhteydet kulkevat vanhan VPN-laitteen kautta, ja tehdas ja toimisto ovat samassa verkossa.",
      budget: 70,
      impactScale: 1,
      owned: ["email"],
      required: ["mfa", "backup", "irplan", "training"],
      regulation: "NIS2",
      tierWeights: { basic: 0.55, advanced: 0.37, apt: 0.08 },
      scenarioWeights: {
        ransomware: 1.5,
        vpn: 2,
        bec: 1.5,
        laptop: 1,
        insider: 1,
        cloud: 0.7,
        supplychain: 0.7,
        helpdesk: 0.5,
        deepfake: 0.5,
        webapp: 0.5,
        ddos: 0.5
      }
    },
    {
      id: "enterprise",
      name: "Finanssiyhtiö",
      icon: "🏦",
      sector: "Pankki- ja vakuutuspalvelut, 2 000 henkeä",
      desc: "MFA, valvonta, EDR ja varmuuskopiot ovat jo kunnossa. Heikkoudet: iso IT-tuki, paljon toimittajia ja vanhoja järjestelmiä.",
      budget: 70,
      impactScale: 2,
      owned: ["email", "mfa", "edr", "siem", "backup"],
      required: ["mfa", "backup", "irplan", "training", "encryption"],
      regulation: "NIS2 ja DORA",
      tierWeights: { basic: 0.35, advanced: 0.45, apt: 0.2 },
      scenarioWeights: {
        helpdesk: 2,
        deepfake: 2,
        supplychain: 1.5,
        ddos: 1.5,
        bec: 1,
        ransomware: 1,
        cloud: 1,
        webapp: 1,
        insider: 1,
        laptop: 1,
        vpn: 0.7
      }
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
      name: "Huipputaso",
      icon: "🕶️",
      strength: 1.7,
      giveUp: 0.02,
      impactScale: 1.6,
      desc: "Valtiollinen tai vastaava toimija, jolla on aikaa ja rahaa. Harvinainen – mutta lähes pysäyttämätön."
    }
  ];

  /*
   * Toimiston pohjapiirros ylhäältä. Sijainnit ja koot ovat prosentteja kartasta.
   * outside = rakennuksen ulkopuolella.
   */
  const rooms = [
    { id: "internet", name: "Internet", short: "Netti", x: 0, y: 0, w: 13, h: 100, outside: true },
    { id: "aula", name: "Aula", short: "Aula", x: 13, y: 0, w: 18, h: 36 },
    { id: "posti", name: "Postihuone", short: "Posti", x: 31, y: 0, w: 16, h: 36 },
    { id: "kauppa", name: "Verkkokauppa", short: "Kauppa", x: 47, y: 0, w: 19, h: 36 },
    { id: "vpn", name: "Etäyhteydet", short: "VPN", x: 66, y: 0, w: 18, h: 36 },
    { id: "konttori", name: "Avokonttori", short: "Konttori", x: 13, y: 36, w: 43, h: 32 },
    { id: "talous", name: "Talous", short: "Talous", x: 56, y: 36, w: 28, h: 32 },
    { id: "ittuki", name: "IT-tuki", short: "IT-tuki", x: 13, y: 68, w: 17, h: 32 },
    { id: "palvelin", name: "Palvelinhuone", short: "Palvelimet", x: 30, y: 68, w: 26, h: 32 },
    { id: "valvomo", name: "Valvomo", short: "Valvomo", x: 56, y: 68, w: 14, h: 32 },
    { id: "kriisi", name: "Kriisihuone", short: "Kriisi", x: 70, y: 68, w: 14, h: 32 },
    { id: "pilvi", name: "Pilvi", short: "Pilvi", x: 84, y: 0, w: 16, h: 50, outside: true },
    { id: "kaupunki", name: "Kaupungilla", short: "Kaupunki", x: 84, y: 50, w: 16, h: 50, outside: true }
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
      start: "internet",
      stages: [
        {
          name: "Tietojenkalastelusähköposti",
          text: "Kirjanpitäjä saa laskuksi naamioidun viestin, jonka liitteessä on haittaohjelma.",
          room: "posti",
          prevent: { email: 0.5, training: 0.35 }
        },
        {
          name: "Haittaohjelman käynnistys",
          text: "Liite avataan ja haittaohjelma yrittää käynnistyä työasemalla.",
          room: "konttori",
          prevent: { edr: 0.6, patch: 0.25 }
        },
        {
          name: "Leviäminen verkossa",
          text: "Hyökkääjä etsii pääkäyttäjätunnuksia ja leviää palvelimille.",
          room: "palvelin",
          prevent: { segment: 0.5, pam: 0.4, mfa: 0.2 }
        },
        {
          name: "Tiedostojen salaus",
          text: "Kiristysohjelma käynnistetään kaikilla saavutetuilla koneilla samanaikaisesti.",
          room: "palvelin",
          prevent: { edr: 0.3 }
        }
      ],
      detect: { siem: 0.6, edr: 0.3 },
      detection: {
        detected: { text: "Hyökkääjän liikkeet verkossa havaittiin {n} tunnissa, ja koneita ehdittiin eristää ennen kuin salaus levisi kaikkialle.", min: 1, max: 12 },
        undetected: { text: "Hyökkäys huomattiin vasta, kun tiedostot oli jo salattu ja lunnasvaatimus ilmestyi näytöille." }
      },
      recover: { backup: 0.7, irplan: 0.3 },
      discuss: "Kuinka monessa päivässä saisimme tärkeimmät järjestelmät takaisin, jos kaikki salattaisiin tänään? Onko se testattu?"
    },
    {
      id: "bec",
      likelihood: 3,
      tiers: ["basic", "advanced"],
      name: "Laskutuspetos",
      icon: "🧾",
      impact: 250,
      intro: "Huijari kaappaa talousosaston sähköpostitilin ja yrittää ohjata toimittajan laskun maksun omalle tililleen.",
      start: "internet",
      stages: [
        {
          name: "Tunnusten kalastelu",
          text: "Talousjohtaja saa viestin, jonka linkki vie aidolta näyttävälle Microsoft 365 -kirjautumissivulle.",
          room: "posti",
          prevent: { email: 0.45, training: 0.35 }
        },
        {
          name: "Sähköpostitilin kaappaus",
          text: "Huijari yrittää kirjautua talousjohtajan tilille kalastellulla salasanalla.",
          room: "talous",
          prevent: { mfa: 0.75 }
        },
        {
          name: "Maksuohjeen muutos",
          text: "Kaapatulta tililtä vastataan aitoon laskuketjuun ja pyydetään maksamaan uudelle tilinumerolle.",
          room: "talous",
          prevent: { verify: 0.7, training: 0.3 }
        }
      ],
      detect: { siem: 0.4 },
      detection: {
        detected: { text: "Poikkeava kirjautuminen havaittiin {n} tunnissa, ja pankkia pyydettiin pysäyttämään maksu.", min: 1, max: 24 },
        undetected: { text: "Huijaus paljastui vasta, kun oikea toimittaja kysyi maksamattoman laskun perään {n} päivän kuluttua.", min: 7, max: 30 }
      },
      recover: { irplan: 0.4 },
      discuss: "Jos toimittaja ilmoittaa uuden tilinumeron sähköpostilla, miten meillä varmistetaan, että viesti on aito?"
    },
    {
      id: "deepfake",
      likelihood: 1,
      tiers: ["basic", "advanced"],
      name: "Deepfake-videopuhelu",
      icon: "🎥",
      impact: 300,
      intro: "Talousjohtaja kutsutaan videopalaveriin, jossa ”toimitusjohtaja” pyytää kiireellistä maksua. Kasvot ja ääni on väärennetty tekoälyllä.",
      start: "internet",
      stages: [
        {
          name: "Kutsu salaiseen palaveriin",
          text: "Viesti tulee toimitusjohtajan nimissä: ”luottamuksellinen yrityskauppa, älä kerro kenellekään”.",
          room: "posti",
          prevent: { email: 0.3, training: 0.3 }
        },
        {
          name: "Väärennetty videopuhelu",
          text: "Puhelussa ovat tutut kasvot ja ääni. Pyyntö: kaksi maksua vielä tänään.",
          room: "talous",
          prevent: { training: 0.35, verify: 0.6 }
        },
        {
          name: "Maksun hyväksyntä",
          text: "Maksu menee läpi, jos yksi ihminen voi hyväksyä sen yksin.",
          room: "talous",
          prevent: { verify: 0.6 }
        }
      ],
      detect: { verify: 0.5 },
      detection: {
        detected: { text: "Toinen hyväksyjä kyseenalaisti maksun {n} tunnin kuluttua, ja pankki ehti jäädyttää osan siitä.", min: 1, max: 24 },
        undetected: { text: "Petos paljastui vasta, kun oikea toimitusjohtaja palasi matkalta {n} päivän kuluttua.", min: 2, max: 10 }
      },
      recover: { irplan: 0.4 },
      discuss: "Jos toimitusjohtaja soittaisi videolla ja pyytäisi kiireellistä maksua, uskaltaisiko kukaan meillä pyytää varmistusta?"
    },
    {
      id: "helpdesk",
      likelihood: 1.5,
      tiers: ["advanced", "apt"],
      name: "Puhelu IT-tukeen",
      icon: "☎️",
      impact: 350,
      intro: "Hyökkääjä soittaa IT-tukeen työntekijänä, jonka puhelin on ”hajonnut”, ja pyytää nollaamaan tämän MFA:n.",
      start: "internet",
      stages: [
        {
          name: "Tunnusten nollaus puhelimessa",
          text: "Soittaja tietää nimen, tittelin ja esihenkilön – kaikki löytyvät LinkedInistä.",
          room: "ittuki",
          prevent: { verify: 0.7, training: 0.25 }
        },
        {
          name: "Oman MFA-laitteen lisääminen",
          text: "Hyökkääjä kirjautuu nollatuilla tunnuksilla ja rekisteröi oman puhelimensa. MFA ei auta, koska se on juuri nollattu.",
          room: "aula",
          prevent: { siem: 0.35 }
        },
        {
          name: "Pääsy järjestelmiin",
          text: "Työntekijän oikeuksilla haetaan tietoja ja etsitään pääkäyttäjätunnuksia.",
          room: "palvelin",
          prevent: { pam: 0.45, segment: 0.3, edr: 0.2 }
        }
      ],
      detect: { siem: 0.5, edr: 0.2 },
      detection: {
        detected: { text: "Uusi MFA-laite ja poikkeava kirjautuminen havaittiin {n} tunnissa, ja tunnukset suljettiin.", min: 1, max: 12 },
        undetected: { text: "Murto paljastui vasta, kun hyökkääjä käynnisti kiristyshaittaohjelman {n} päivän kuluttua.", min: 2, max: 10 }
      },
      recover: { backup: 0.3, irplan: 0.35 },
      discuss: "Miten IT-tukemme varmistaa soittajan henkilöllisyyden ennen kuin se nollaa salasanan tai MFA:n?"
    },
    {
      id: "cloud",
      likelihood: 2,
      tiers: ["basic", "advanced"],
      name: "Pilvipalvelun tilikaappaus",
      icon: "☁️",
      impact: 300,
      intro: "Työntekijän koneelle tarttuu salasanoja varastava haittaohjelma. Tunnukset myydään rikollisille.",
      start: "internet",
      stages: [
        {
          name: "Salasanojen varkaus",
          text: "Ilmaiseksi ladattu ohjelma kopioi selaimeen tallennetut salasanat ja kirjautumiset.",
          room: "konttori",
          prevent: { edr: 0.5, training: 0.2 }
        },
        {
          name: "Kirjautuminen pilvipalveluun",
          text: "Ostetuilla tunnuksilla kirjaudutaan asiakastiedot sisältävään pilvipalveluun. Joskus mukana on myös valmis kirjautumisistunto.",
          room: "pilvi",
          prevent: { mfa: 0.65 }
        },
        {
          name: "Tietojen massalataus",
          text: "Koko asiakastietokanta ladataan ulos muutamassa tunnissa.",
          room: "pilvi",
          prevent: { siem: 0.35, pam: 0.35 }
        }
      ],
      detect: { siem: 0.5 },
      detection: {
        detected: { text: "Poikkeava massalataus havaittiin {n} tunnissa, ja tunnukset suljettiin.", min: 1, max: 12 },
        undetected: { text: "Vuoto paljastui vasta, kun hyökkääjä lähetti kiristysviestin {n} päivän kuluttua.", min: 3, max: 21 }
      },
      recover: { irplan: 0.4 },
      discuss: "Missä pilvipalveluissa meillä on asiakastietoja – ja onko jokaisessa MFA päällä?"
    },
    {
      id: "webapp",
      likelihood: 2,
      tiers: ["basic", "advanced", "apt"],
      name: "Verkkopalvelun haavoittuvuus",
      icon: "🕸️",
      impact: 300,
      intro: "Hyökkääjä etsii aukkoja yrityksen verkkopalvelusta päästäkseen käsiksi asiakastietoihin.",
      start: "internet",
      stages: [
        {
          name: "Haavoittuvuuksien etsintä",
          text: "Automaattinen skanneri käy läpi verkkopalvelun sivut ja lomakkeet.",
          room: "kauppa",
          prevent: { waf: 0.4, patch: 0.3 }
        },
        {
          name: "Haavoittuvuuden hyväksikäyttö",
          text: "Hakukentän kautta syötetään tietokantakomentoja.",
          room: "kauppa",
          prevent: { waf: 0.5, patch: 0.3 }
        },
        {
          name: "Asiakastietojen kopiointi",
          text: "Palvelun kautta luetaan asiakkaiden yhteystiedot ja salasanatiivisteet.",
          room: "palvelin",
          prevent: { pam: 0.4, waf: 0.2, siem: 0.2 }
        }
      ],
      detect: { siem: 0.5, waf: 0.2 },
      detection: {
        detected: { text: "Poikkeavat tietokantakyselyt havaittiin {n} tunnissa, ja haavoittuva kenttä suljettiin.", min: 1, max: 24 },
        undetected: { text: "Tietovuoto paljastui vasta, kun asiakastiedot ilmestyivät myyntiin rikollisfoorumille {n} päivän kuluttua.", min: 14, max: 60 }
      },
      recover: { irplan: 0.4 },
      discuss: "Kuka meillä vastaa verkkopalvelun tietoturvasta – me itse vai toimittaja? Onko se kirjattu sopimukseen?"
    },
    {
      id: "ddos",
      likelihood: 1.5,
      tiers: ["basic", "advanced"],
      name: "Palvelunestohyökkäys",
      icon: "🌪️",
      impact: 150,
      intro: "Hakkeriaktivistit yrittävät kaataa verkkopalvelun kesken vilkkaimman sesongin.",
      start: "internet",
      stages: [
        {
          name: "Liikennetulva",
          text: "Kymmeniä gigabittejä roskaliikennettä sekunnissa.",
          room: "kauppa",
          prevent: { ddos: 0.85, waf: 0.2 }
        },
        {
          name: "Raskaat sivupyynnöt",
          text: "Raskaita hakuja, jotka näyttävät oikeilta käyttäjiltä.",
          room: "kauppa",
          prevent: { waf: 0.4, ddos: 0.4 }
        }
      ],
      detect: { siem: 0.5 },
      detection: {
        detected: { text: "Palvelunesto tunnistettiin {n} minuutissa, ja liikenne ohjattiin suodatukseen.", min: 5, max: 30 },
        undetected: { text: "Palvelunesto tunnistettiin vasta {n} tunnin kuluttua – siihen asti vikaa etsittiin omista palvelimista.", min: 2, max: 8 }
      },
      recover: { irplan: 0.5 },
      discuss: "Kuinka paljon meille maksaa tunti, jolloin verkkopalvelu on alhaalla? Kuka päättää, mitä silloin tehdään?"
    },
    {
      id: "insider",
      likelihood: 1,
      tiers: ["basic", "advanced", "apt"],
      name: "Sisäpiirin uhka",
      icon: "🕴️",
      impact: 280,
      intro: "Irtisanoutuva työntekijä aikoo viedä asiakasrekisterin mukanaan kilpailijalle.",
      start: "konttori",
      stages: [
        {
          name: "Liian laajat oikeudet",
          text: "Työntekijälle on vuosien varrella kertynyt pääsy lähes kaikkeen.",
          room: "konttori",
          prevent: { pam: 0.6, segment: 0.2 }
        },
        {
          name: "Tietojen keruu",
          text: "Asiakasrekisteri ja tarjoukset ladataan omalle koneelle.",
          room: "palvelin",
          prevent: { siem: 0.35 }
        },
        {
          name: "Tietojen vienti ulos",
          text: "Tiedostot lähetetään yksityiseen sähköpostiin ja kopioidaan USB-tikulle.",
          room: "konttori",
          prevent: { edr: 0.3, siem: 0.3, email: 0.15 }
        }
      ],
      detect: { siem: 0.6 },
      detection: {
        detected: { text: "Poikkeava tiedonsiirto havaittiin {n} tunnissa, ja tunnukset suljettiin.", min: 1, max: 48 },
        undetected: { text: "Tietovuoto paljastui vasta, kun asiakkaita alkoi siirtyä kilpailijalle {n} viikon kuluttua.", min: 2, max: 8 }
      },
      recover: { irplan: 0.4 },
      discuss: "Kun joku vaihtaa tehtävää tai lähtee talosta, kuka tarkistaa ja poistaa hänen käyttöoikeutensa?"
    },
    {
      id: "supplychain",
      likelihood: 0.5,
      tiers: ["advanced", "apt"],
      name: "Toimitusketjuhyökkäys",
      icon: "📦",
      impact: 450,
      intro: "Käyttämänne ohjelmiston toimittajaan on murtauduttu, ja sen virallinen päivitys sisältää takaoven. Päivitys on jo asennettu.",
      start: "internet",
      stages: [
        {
          name: "Takaoven herääminen",
          text: "Viikkojen hiljaiselon jälkeen takaovi alkaa tutkia ympäristöä.",
          room: "palvelin",
          prevent: { edr: 0.35, segment: 0.25 }
        },
        {
          name: "Yhteys hyökkääjälle",
          text: "Takaovi ottaa yhteyttä hyökkääjän palvelimeen ja odottaa käskyjä.",
          room: "internet",
          prevent: { segment: 0.35, siem: 0.35 }
        }
      ],
      detect: { siem: 0.5, edr: 0.3 },
      detection: {
        detected: { text: "Epäilyttävä yhteys hyökkääjän palvelimelle havaittiin {n} päivässä.", min: 1, max: 7 },
        undetected: { text: "Takaovi paljastui vasta, kun toimittaja tiedotti murrosta {n} kuukauden kuluttua.", min: 2, max: 9 }
      },
      recover: { irplan: 0.4, backup: 0.2 },
      discuss: "Mitkä toimittajat pääsevät meidän järjestelmiimme – ja mitä tekisimme, jos yksi niistä murrettaisiin huomenna?"
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
      start: "kaupunki",
      stages: [
        {
          name: "Lukituksen ohittaminen",
          text: "Kirjautumissalasana ei suojaa levyä: löytäjä irrottaa levyn tai käynnistää koneen USB-tikulta ja lukee tiedostot suoraan.",
          room: "kaupunki",
          prevent: { encryption: 0.9 }
        },
        {
          name: "Kirjautuminen pilvipalveluihin",
          text: "Levyltä löytyy selaimeen tallennettuja salasanoja, joilla yritetään kirjautua yrityksen sähköpostiin ja pilvipalveluihin.",
          room: "pilvi",
          prevent: { mfa: 0.8 }
        }
      ],
      detect: { siem: 0.3 },
      detection: {
        detected: { text: "Kirjautuminen tuntemattomalta laitteelta havaittiin {n} tunnissa, ja tunnukset suljettiin.", min: 1, max: 6 },
        undetected: { text: "Tunnukset suljettiin vasta, kun myyntipäällikkö ilmoitti laitteen kadonneeksi {n} päivän kuluttua.", min: 1, max: 3 }
      },
      recover: { irplan: 0.3 },
      discuss: "Tietääkö jokainen meillä, kenelle ilmoitetaan heti, jos läppäri tai puhelin katoaa?"
    },
    {
      id: "vpn",
      likelihood: 2,
      tiers: ["basic", "advanced", "apt"],
      name: "Paikkaamaton VPN-laite",
      icon: "🚪",
      impact: 350,
      intro: "VPN-laitteesta on julkaistu kriittinen haavoittuvuus – ja hyökkääjät skannaavat koko internetiä.",
      start: "internet",
      stages: [
        {
          name: "Haavoittuvuuden hyväksikäyttö",
          text: "Automaattinen työkalu löytää yrityksen VPN-laitteen ja kokeilee julkaistua hyökkäyskoodia.",
          room: "vpn",
          prevent: { patch: 0.7 }
        },
        {
          name: "Tunnusten keruu",
          text: "Hyökkääjä kerää laitteelta VPN-käyttäjien salasanoja.",
          room: "vpn",
          prevent: { mfa: 0.5 }
        },
        {
          name: "Pääsy sisäverkkoon",
          text: "VPN-laitteelta siirrytään sisäverkon palvelimille.",
          room: "palvelin",
          prevent: { segment: 0.5, pam: 0.3, edr: 0.3 }
        }
      ],
      detect: { siem: 0.5, edr: 0.2 },
      detection: {
        detected: { text: "Poikkeava toiminta VPN-laitteella havaittiin {n} tunnissa.", min: 1, max: 24 },
        undetected: { text: "Murto paljastui vasta, kun Kyberturvallisuuskeskus ilmoitti siitä {n} päivän kuluttua.", min: 5, max: 30 }
      },
      recover: { backup: 0.3, irplan: 0.35 },
      discuss: "Kuinka nopeasti paikkaamme internetiin näkyvät laitteet, kun kriittinen haavoittuvuus julkaistaan – tunneissa vai viikoissa?"
    }
  ];

  const data = { controls, difficulties, attackerTiers, scenarios, rooms, frictionLimit };

  if (typeof module === "object" && module.exports) {
    module.exports = data;
  } else {
    root.GameData = data;
  }
})(this);
