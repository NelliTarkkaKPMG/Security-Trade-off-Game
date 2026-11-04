/*
 * Pelin oma kuvakesarja (SVG, 24×24). Viivat piirretään currentColor-värillä,
 * ja luokka "fill" antaa kuvakkeelle kaksisävyisen täytteen.
 * Avaimet: suojaukset id:llä, skenaariot "s-"-etuliitteellä, yritykset "c-"-etuliitteellä.
 */
(function (root) {
  const icons = {
    // Suojaukset
    mfa: '<rect class="fill" x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9.5 11.5l2 2 3.5-4"/><path d="M10.5 18.3h3"/>',
    email: '<rect x="2.5" y="5" width="16" height="12" rx="2"/><path d="M3 6.5l7.5 5.5 7.5-5.5"/><circle class="fill" cx="18" cy="17.5" r="4"/><path d="M16.3 17.5l1.2 1.2 2.2-2.4"/>',
    training: '<rect class="fill" x="3" y="3.5" width="18" height="12.5" rx="1.5"/><path d="M7 7.5h6M7 11h9"/><path d="M8 20.5l4-4.5 4 4.5"/>',
    verify: '<path class="fill" d="M4 4.5h16v11H9.5L4 20z"/><path d="M8.5 10l2.2 2.2 4.8-4.7"/>',
    edr: '<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2.5 19h19"/><path class="fill" d="M12 6.8l3 1.2v2.3c0 1.8-1.3 3.1-3 3.7-1.7-.6-3-1.9-3-3.7V8z"/>',
    backup: '<ellipse class="fill" cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    patch: '<rect class="fill" x="2" y="8.5" width="20" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M10.5 10.5l3 3"/><path d="M7.5 13.5l3 3M13.5 7.5l3 3"/>',
    segment: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect class="fill" x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    waf: '<path class="fill" d="M12 2.5l7.5 3v6c0 4.5-3.2 8-7.5 10-4.3-2-7.5-5.5-7.5-10v-6z"/><path d="M8 12h8"/><path d="M12 7.5c1.6 2 1.6 7 0 9M12 7.5c-1.6 2-1.6 7 0 9"/>',
    siem: '<circle cx="12" cy="12" r="9"/><circle class="fill" cx="12" cy="12" r="5"/><path d="M12 12l6.3-6.3"/><circle cx="15.2" cy="9.3" r="0.9"/>',
    pam: '<circle class="fill" cx="7.5" cy="12" r="4.5"/><path d="M12 12h9.5M19 12v3.5M16 12v2.5"/><circle cx="7.5" cy="12" r="1.3"/>',
    encryption: '<rect class="fill" x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/><path d="M12 14.5v2.5"/>',
    ddos: '<path class="fill" d="M3.5 4.5h17l-6.5 7.5v6l-4 2.5v-8.5z"/><path d="M8 4.5l4 4.5"/>',
    irplan: '<rect x="5" y="4" width="14" height="17.5" rx="2"/><rect class="fill" x="8.5" y="2.5" width="7" height="4" rx="1"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',

    // Skenaariot
    "s-ransomware": '<path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4"/><rect class="fill" x="8.5" y="13" width="7" height="5.5" rx="1"/><path d="M10 13v-1.3a2 2 0 014 0V13"/>',
    "s-bec": '<path class="fill" d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    "s-deepfake": '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path class="fill" d="M15.5 10.5l6-3.5v10l-6-3.5z"/><circle cx="9" cy="10.5" r="2"/><path d="M5.8 16c.6-1.8 1.8-2.7 3.2-2.7s2.6.9 3.2 2.7"/>',
    "s-helpdesk": '<path d="M4.5 14v-2a7.5 7.5 0 0115 0v2"/><rect class="fill" x="3" y="13" width="4.5" height="6" rx="1.5"/><rect class="fill" x="16.5" y="13" width="4.5" height="6" rx="1.5"/><path d="M18.5 19c0 1.5-1.6 2.3-3.5 2.3h-2"/>',
    "s-cloud": '<path class="fill" d="M7 19a4.5 4.5 0 01-.6-9 6 6 0 0111.7 1.4A3.8 3.8 0 0117.6 19z"/><path d="M12 10.5v4"/><circle cx="12" cy="16.6" r="0.6"/>',
    "s-webapp": '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path class="fill" d="M2.5 6a2 2 0 012-2h15a2 2 0 012 2v2.5h-19z"/><path d="M10 12l-2.5 2.5L10 17M14 12l2.5 2.5L14 17"/>',
    "s-ddos": '<rect class="fill" x="15.5" y="4" width="6" height="16" rx="1.5"/><path d="M2.5 7h9.5M2.5 12h10.5M2.5 17h9.5"/><path d="M10 5l2 2-2 2M11 10l2 2-2 2M10 15l2 2-2 2"/>',
    "s-insider": '<circle class="fill" cx="9.5" cy="7" r="3.5"/><path d="M3.5 20.5c0-3.8 2.7-6.5 6-6.5s6 2.7 6 6.5"/><path d="M16.5 10.5H21M19 8.5l2 2-2 2"/>',
    "s-supplychain": '<path class="fill" d="M12 2.5l8.5 4.7v9.6L12 21.5l-8.5-4.7V7.2z"/><path d="M3.8 7.4L12 12l8.2-4.6M12 12v9.3"/>',
    "s-laptop": '<rect class="fill" x="4.5" y="4.5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19"/><path d="M10.4 8.2a1.7 1.7 0 113.1 1c-.6.5-1.5.8-1.5 1.9"/><circle cx="12" cy="13" r="0.5"/>',
    "s-vpn": '<rect class="fill" x="2.5" y="12" width="19" height="7.5" rx="2"/><path d="M7 12V7.5M17 12V7.5"/><circle cx="7" cy="15.8" r="0.8"/><path d="M11 15.8h6"/>',

    // Yritykset
    "c-startup": '<rect class="fill" x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M8.5 9L5.5 12l3 3M15.5 9l3 3-3 3M13.5 7.5l-3 9"/>',
    "c-sme": '<path class="fill" d="M2.5 20.5V10l5.5 3.3V10l5.5 3.3V10l5 3V3.5h3v17z"/><path d="M2 20.5h20"/>',
    "c-enterprise": '<path class="fill" d="M2.5 9L12 3.5 21.5 9z"/><path d="M5 9.5v8M9.7 9.5v8M14.3 9.5v8M19 9.5v8M3 20.5h18"/>'
  };

  if (typeof module === "object" && module.exports) {
    module.exports = icons;
  } else {
    root.GameIcons = icons;
  }
})(this);
