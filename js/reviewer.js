/*
 * Tulosnäkymän arvioija: parodinen "Sydney Sweeney arvioi" -kommentti
 * jokaiselle skenaariolle ja tulostasolle. Kommentit kohdistuvat pelaajan
 * valintoihin, eivät arvioijaan itseensä.
 *
 * Kuvaa ei tallenneta repoon tekijänoikeussyistä. Lisää se paikallisesti
 * polkuun image (ks. assets/reviewer/README.md). Jos kuvaa ei löydy,
 * näytetään fallback-emoji.
 */
(function (root) {
  const reviewer = {
    name: "Sydney Sweeney",
    title: "Sydney Sweeney arvioi",
    image: "assets/reviewer/sydney.png",
    fallback: "💅",
    disclaimer: "Parodia – ei oikeita lausuntoja.",

    // Tulostasot ryhmiteltyinä: good = blocked/minor, mid = moderate, bad = major/critical.
    lucky: "Hyökkääjä luovutti itse. En kutsuisi tätä strategiaksi, mutta otan sen.",
    lines: {
      ransomware: {
        good: "Tiedostot salaamatta, lunnaat maksamatta. Tämä on sinun vuotesi.",
        mid: "Osa palvelimista salattiin. Ei katastrofi, mutta en laittaisi tätä LinkedIniin.",
        bad: "Lunnasvaatimus näytöllä ja palautus kestää viikkoja? Itken, ja tällä kertaa en näyttele."
      },
      bec: {
        good: "Talousjohtaja soitti toimittajalle ja tarkisti tilinumeron. Harvinaista. Ihailen.",
        mid: "Maksu ehdittiin osittain perua. Pankki ei ole ystäväsi, mutta tänään se oli.",
        bad: "Rahat lähtivät huijarille, koska viestissä luki 'kiireellinen'. Kulta, ei."
      },
      stuffing: {
        good: "Botit kokeilivat miljoonaa salasanaa ja saivat pakit. Tunnistan fiiliksen.",
        mid: "Muutama asiakastili meni. Asiakaspalvelu vihaa sinua nyt hiljaa.",
        bad: "Asiakkaiden salasana on 'Kesä2024!' eikä MFA:ta ole. Tämä ei ole rakkaustarina."
      },
      webapp: {
        good: "SQL-injektio kimposi takaisin. Siisti koodi on aina paras asu.",
        mid: "Osa tiedoista vuoti. Ei skandaali, mutta otsikko kyllä.",
        bad: "Asiakastiedot myynnissä rikollisfoorumilla. Tämä juonenkäänne ei saa jatkokautta."
      },
      ddos: {
        good: "Sivusto pysyi pystyssä kesken alennusmyynnin. Draamaa ilman yleisöä.",
        mid: "Pari tuntia katkoa. Kuin ensi-ilta, jossa valot sammuvat välillä.",
        bad: "Verkkokauppa nurin koko alennusmyynnin ajan. Edes minun ensi-iltani eivät saa näin paljon liikennettä."
      },
      insider: {
        good: "Lähtevä työntekijä ei saanut mukaansa mitään. Eropaketti: pelkkä kakku.",
        mid: "Osa asiakasrekisteristä lähti. Ero oli sotkuisempi kuin piti.",
        bad: "Kaikilla oikeudet kaikkeen vuosikausia? Ei ihme, että asiakasrekisteri lähti kilpailijalle."
      },
      supplychain: {
        good: "Takaovi jäi kiinni ennen kuin ehti soittaa kotiin. Vainoharhaisuus pukee sinua.",
        mid: "Takaovi löytyi päivissä. Ei kaunista, mutta selvisit.",
        bad: "Takaovi auki kuukausia etkä huomannut mitään. Tätä kutsutaan ghostaamiseksi."
      },
      laptop: {
        good: "Levy salattu, MFA päällä. Kone katosi, tiedot eivät. Tyylikästä.",
        mid: "Tunnukset suljettiin ajoissa. Myyntipäällikkö tarjoaa kahvit koko tiimille.",
        bad: "Salaamaton kone junassa on käytännössä julkinen jakokansio."
      },
      vpn: {
        good: "Paikattu ajoissa. Sinä luet tietoturvatiedotteet, minä luen käsikirjoitukset.",
        mid: "Murto jäi pieneksi eikä Kyberturvallisuuskeskus soittanut. Pieni voitto.",
        bad: "Kyberturvallisuuskeskus kertoi murrosta ennen kuin huomasit sen itse. Noloa."
      }
    },
    // Lisätään keskinkertaisiin ja huonoihin tuloksiin; {control} = eniten auttanut kontrolli.
    tip: "Ensi kerralla: {control}. Kiitos."
  };

  if (typeof module === "object" && module.exports) {
    module.exports = reviewer;
  } else {
    root.GameReviewer = reviewer;
  }
})(this);
