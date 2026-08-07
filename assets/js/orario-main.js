(() => {
  // --- SISTEMA DI DEBUG A SCHERMO PER IOS ---
  function logErrorToScreen(message, source) {
    const detail = document.querySelector(".og-detail");
    if (detail) {
      detail.innerHTML = '<strong style="color:#ef4444;">ERRORE CRITICO:</strong> ' + message + ' <br><span style="font-size:0.8em; opacity:0.8;">' + (source || '') + '</span>';
      detail.style.color = '#ef4444';
    }
  }

  window.addEventListener('error', function(event) {
    logErrorToScreen(event.message, "riga: " + event.lineno);
  });

  try {
    const root = document.getElementById("orario-garda-viz");
    const shared = window.NaviOrarioShared || {};
    const fromRoot = (selector) => (root ? root.querySelector(selector) : null);

    const svg = fromRoot(".og-chart");
    const chartStage = fromRoot(".og-chart-stage");
    const stopAxis = fromRoot(".og-stop-axis");
    const timeAxis = fromRoot(".og-time-axis");
    const allRacesButton = fromRoot("#og-tutte");
    const noRacesButton = fromRoot("#og-nessuna");
    const summary = fromRoot(".og-summary");
    const detail = fromRoot(".og-detail");
    const selectedCoursePills = fromRoot(".og-selected-course-pills");
    const selectedCoursePillList = fromRoot(".og-selected-course-pill-list-main");
    const selectedCoincidencePillList = fromRoot(".og-selected-course-pill-list-coincidences");
    const mobileMenuToggle = fromRoot(".og-mobile-menu-toggle");
    const mobileMenuBackdrop = fromRoot(".og-mobile-menu-backdrop");
    const tooltip = fromRoot(".og-tooltip");
    const coincidenceToggle = fromRoot(".og-coincidence-toggle");
    const residences = fromRoot(".og-residences");
    const normalMatrix = fromRoot(".og-normal-matrix");
    const rapidMatrix = fromRoot(".og-rapid-matrix");
    const tabChart = fromRoot(".og-tab-chart");
    const tabMatrix = fromRoot(".og-tab-matrix");
    const pageChart = fromRoot(".og-page-chart");
    const pageMatrix = fromRoot(".og-page-matrix");
    const courseCard = fromRoot(".og-course-card");
    const courseTitle = fromRoot(".og-course-title");
    const courseCode = fromRoot(".og-course-code");
    const courseSummary = fromRoot(".og-course-summary");
    const miniChart = fromRoot(".og-mini-chart");
    const courseStopsBody = fromRoot(".og-course-stops tbody");
    const courseClose = fromRoot(".og-course-close");
    const coursePrev = fromRoot(".og-course-prev");
    const courseNext = fromRoot(".og-course-next");
    const chartWrap = fromRoot(".og-chart-wrap"); 
    const zoomControls = fromRoot(".og-zoom-controls");
    const zoomValue = fromRoot(".og-zoom-value"); 
    const zoomOut = fromRoot(".og-zoom-out");     
    const zoomIn = fromRoot(".og-zoom-in");

    // Variabili per la linea rossa dell'ora
    let displayedTimeMinutes = null;

    function getDisplayedTimeMinutes() {
      if (displayedTimeMinutes !== null) return displayedTimeMinutes;
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }       

    const data = {"stops":["DESENZANO","PESCHIERA","SIRMIONE","PADENGHE","MONIGA","LAZISE","MANERBA (Dusano)","CISANO","BARDOLINO","GARDA","TORRI","PORTESE","SALÒ","GARDONE","MADERNO","BOGLIACO","GARGNANO","TIGNALE","CASTELLETTO","BRENZONE","ASSENZA di Brenzone","CAMPIONE (Tremosine)","MALCESINE centro","LIMONE multipiano","LIMONE centro","TORBOLE","RIVA"],"services":[{"r":"14","s":"P2","d":"N","p":[[1,480],[5,508],[8,525],[9,540]]},{"r":"28","s":"D3","d":"N","p":[[0,480],[2,500],[4,522],[6,536],[11,566],[12,577],[13,591]]},{"r":"40","s":"D4","d":"N","p":[[0,495],[6,525]]},{"r":"8","s":"D2","d":"N","p":[[0,500],[2,520],[8,560],[9,575]]},{"r":"62","s":"R2","d":"N","p":[[22,535],[24,555],[25,585],[26,600]]},{"r":"72","s":"R3","d":"N","p":[[22,585],[24,610],[25,643],[26,660]]},{"r":"92","s":"M1","d":"N","p":[[11,518],[12,530],[13,544],[14,559],[16,590],[19,620],[24,660]]},{"r":"110","s":"SR1","d":"N","p":[[1,530],[2,550],[9,571],[10,585],[12,609],[13,619],[16,636],[22,655],[24,665]]},{"r":"82","s":"R4","d":"N","p":[[21,642],[22,660],[24,680],[26,715]]},{"r":"64","s":"R2","d":"N","p":[[22,675],[23,703],[25,740],[26,755]]},{"r":"74","s":"R3","d":"N","p":[[22,745],[24,770],[26,810]]},{"r":"22","s":"D1","d":"N","p":[[0,535],[2,555],[5,637],[7,625],[8,615],[9,600]]},{"r":"2","s":"P1","d":"N","p":[[1,550],[5,578],[7,590],[8,600],[9,615],[11,657],[12,668],[13,682],[14,696],[15,721],[16,729],[17,747],[21,763],[22,782],[24,804],[26,840]]},{"r":"160","s":"CAP1","d":"N","p":[[0,560],[9,591],[12,621],[13,633],[16,654],[18,667],[19,675],[22,693],[24,710],[26,735]]},{"r":"42","s":"D4","d":"N","p":[[2,580],[5,620],[7,633],[8,643],[9,660]]},{"r":"34","s":"P3","d":"N","p":[[1,585],[2,625],[9,670]]},{"r":"16","s":"P2","d":"N","p":[[0,615],[2,637],[5,678],[8,695],[9,711],[11,753],[13,764],[14,780]]},{"r":"24","s":"D1","d":"N","p":[[1,680],[5,708],[7,721],[8,731],[9,746],[10,773],[18,806],[19,816],[20,827],[22,845]]},{"r":"84","s":"R4","d":"N","p":[[22,850],[24,870]]},{"r":"10","s":"D2","d":"N","p":[[0,690],[2,715],[5,755],[8,773],[9,790]]},{"r":"66","s":"R2","d":"N","p":[[22,870],[23,890],[24,898],[25,928],[26,945]]},{"r":"152","s":"CAR1","d":"N","p":[[0,760],[2,780],[9,808]]},{"r":"36","s":"P3","d":"N","p":[[1,790],[2,836],[5,885],[7,898],[8,909],[9,925]]},{"r":"86","s":"R4","d":"N","p":[[22,895],[24,918],[26,955]]},{"r":"76","s":"R3","d":"N","p":[[22,945],[26,1000]]},{"r":"96","s":"M1","d":"N","p":[[11,855],[12,865],[13,879],[16,919],[19,948],[24,990]]},{"r":"30","s":"D3","d":"N","p":[[0,825],[2,850],[7,890],[8,900],[9,915],[11,960],[12,975],[13,990]]},{"r":"44","s":"D4","d":"N","p":[[1,860],[2,900],[4,923],[6,937]]},{"r":"112","s":"SR1","d":"N","p":[[0,870],[2,881],[9,903],[12,924],[13,933],[16,950],[22,969],[24,980],[26,1005]]},{"r":"68","s":"R2","d":"N","p":[[22,995],[24,1018],[25,1050],[26,1065]]},{"r":"162","s":"CAP1","d":"N","p":[[2,937],[8,960],[9,971],[14,995],[24,1035]]},{"r":"88","s":"R4","d":"N","p":[[20,1040],[22,1060],[24,1080],[26,1115]]},{"r":"78","s":"R3","d":"N","p":[[22,1085],[24,1110],[25,1143],[26,1160]]},{"r":"70","s":"R2","d":"N","p":[[22,1125],[26,1170]]},{"r":"6","s":"R1","d":"N","p":[[0,900],[2,922],[9,967],[11,1009],[12,1020],[13,1033],[14,1046],[15,1071],[16,1078],[17,1095],[20,1123],[21,1110],[22,1140],[24,1160],[25,1190],[26,1205]]},{"r":"12","s":"D2","d":"N","p":[[1,930],[5,958],[7,970],[8,980],[9,995]]},{"r":"46","s":"D4","d":"N","p":[[0,995],[2,1018],[6,1041]]},{"r":"156","s":"CAR1","d":"N","p":[[0,1000],[1,970],[2,1012],[9,1034],[12,1060],[13,1070],[16,1095],[18,1109],[19,1117],[22,1133],[24,1148],[25,1166],[26,1180]]},{"r":"38","s":"P3","d":"N","p":[[1,995],[5,1023],[8,1040],[9,1055]]},{"r":"18","s":"P2","d":"N","p":[[0,1030],[2,1055],[9,1100]]},{"r":"98","s":"M1","d":"N","p":[[9,1105],[11,1145],[12,1158],[13,1173],[14,1190]]},{"r":"26","s":"D1","d":"N","p":[[1,1080],[5,1109],[7,1122],[8,1132],[9,1150]]},{"r":"48","s":"D4","d":"N","p":[[0,1095],[2,1115],[6,1138]]},{"r":"114","s":"SR1","d":"N","p":[[0,1140],[1,1170],[2,1153]]},{"r":"90","s":"R4","d":"N","p":[[22,1185],[26,1230]]},{"r":"61","s":"R2","d":"S","p":[[26,480],[23,515],[22,535]]},{"r":"91","s":"M1","d":"S","p":[[14,500],[11,518]]},{"r":"41","s":"D4","d":"S","p":[[6,525],[4,540],[3,554],[2,580]]},{"r":"159","s":"CAP1","d":"S","p":[[2,538],[1,510],[0,555]]},{"r":"33","s":"P3","d":"S","p":[[9,515],[8,530],[5,547],[1,575]]},{"r":"15","s":"P2","d":"S","p":[[9,540],[8,525],[5,508],[2,585],[0,605]]},{"r":"9","s":"D2","d":"S","p":[[9,575],[8,590],[7,598],[5,610],[2,657],[0,680]]},{"r":"23","s":"D1","d":"S","p":[[9,600],[8,615],[7,625],[5,637],[1,665]]},{"r":"151","s":"CAR1","d":"S","p":[[26,500],[25,507],[24,525],[22,537],[19,553],[16,568],[14,589],[13,601],[12,615],[11,625],[9,655],[2,685],[0,700]]},{"r":"29","s":"D3","d":"S","p":[[13,591],[12,605],[11,617],[9,663],[8,678],[5,697],[2,743],[0,765]]},{"r":"35","s":"P3","d":"S","p":[[9,670],[8,685],[5,702],[1,730]]},{"r":"43","s":"D4","d":"S","p":[[9,660],[6,700],[4,714],[3,728],[2,758],[1,800]]},{"r":"71","s":"R3","d":"S","p":[[26,520],[24,560],[22,585]]},{"r":"5","s":"R1","d":"S","p":[[26,530],[25,545],[24,575],[22,595],[20,611],[21,625],[17,640],[16,657],[15,664],[14,690],[13,703],[12,718],[11,728],[9,770],[2,816],[0,840]]},{"r":"81","s":"R4","d":"S","p":[[26,560],[25,575],[24,605],[22,625],[21,642]]},{"r":"63","s":"R2","d":"S","p":[[26,605],[25,620],[23,653],[22,675]]},{"r":"93","s":"M1","d":"S","p":[[24,660],[22,680],[18,715],[13,770],[12,785]]},{"r":"111","s":"SR1","d":"S","p":[[24,670],[22,681],[13,719],[12,729],[10,705],[9,749],[8,758],[2,776],[0,785]]},{"r":"73","s":"R3","d":"S","p":[[26,670],[25,687],[24,720],[22,745]]},{"r":"83","s":"R4","d":"S","p":[[26,720],[25,735],[24,765],[22,785]]},{"r":"161","s":"CAP1","d":"S","p":[[26,805],[24,825],[22,839],[14,875],[13,887],[12,900],[2,932]]},{"r":"65","s":"R2","d":"S","p":[[26,815],[23,850],[22,870]]},{"r":"153","s":"CAR1","d":"S","p":[[9,808],[8,820],[5,835],[2,865],[1,900]]},{"r":"11","s":"D2","d":"S","p":[[9,855],[8,871],[7,881],[5,894],[1,925]]},{"r":"45","s":"D4","d":"S","p":[[6,937],[2,962],[0,985]]},{"r":"155","s":"CAR1","d":"S","p":[[1,970],[0,995]]},{"r":"95","s":"M1","d":"S","p":[[12,845],[11,855]]},{"r":"17","s":"P2","d":"S","p":[[14,840],[13,855],[12,868],[11,879],[9,922],[8,937],[5,954],[2,996],[0,1025]]},{"r":"37","s":"P3","d":"S","p":[[9,930],[8,945],[5,962],[1,990]]},{"r":"85","s":"R4","d":"S","p":[[24,875],[22,895]]},{"r":"25","s":"D1","d":"S","p":[[22,905],[20,922],[19,933],[18,943],[10,975],[9,1005],[8,1020],[7,1030],[5,1045],[1,1075]]},{"r":"75","s":"R3","d":"S","p":[[26,870],[25,887],[24,920],[22,945]]},{"r":"47","s":"D4","d":"S","p":[[6,1041],[4,1055],[3,1068],[0,1090]]},{"r":"13","s":"D2","d":"S","p":[[9,1015],[8,1030],[2,1075],[0,1105]]},{"r":"39","s":"P3","d":"S","p":[[9,1055],[2,1100],[1,1140]]},{"r":"31","s":"D3","d":"S","p":[[13,990],[12,1004],[11,1016],[9,1061],[8,1076],[5,1094],[2,1135],[0,1160]]},{"r":"49","s":"D4","d":"S","p":[[6,1138],[4,1152],[3,1165],[0,1185]]},{"r":"19","s":"P2","d":"S","p":[[9,1100],[8,1115],[5,1132],[1,1160]]},{"r":"97","s":"M1","d":"S","p":[[24,990],[22,1012],[19,1038],[10,1080],[9,1105]]},{"r":"3","s":"P1","d":"S","p":[[26,915],[24,950],[22,975],[21,993],[17,1009],[16,1027],[15,1034],[14,1060],[13,1074],[12,1088],[11,1099],[9,1142],[8,1156],[7,1165],[5,1178],[1,1210]]},{"r":"67","s":"R2","d":"S","p":[[26,950],[22,995]]},{"r":"87","s":"R4","d":"S","p":[[26,965],[24,1000],[22,1020],[20,1040]]},{"r":"113","s":"SR1","d":"S","p":[[26,1005],[24,1030],[22,1041],[13,1087],[12,1077],[10,1102],[8,1117],[2,1153],[1,1170],[0,1135]]},{"r":"163","s":"CAP1","d":"S","p":[[24,1040],[22,1055],[16,1081],[14,1100],[13,1112],[9,1135],[8,1146],[5,1156],[1,1175]]},{"r":"77","s":"R3","d":"S","p":[[26,1010],[25,1027],[24,1060],[22,1085]]},{"r":"69","s":"R2","d":"S","p":[[26,1070],[24,1105],[22,1125]]},{"r":"89","s":"R4","d":"S","p":[[26,1120],[25,1135],[24,1165],[22,1185]]},{"r":"27","s":"D1","d":"S","p":[[9,1150],[8,1132],[7,1122],[5,1109],[2,1195],[0,1215]]}],"shifts":{"D1":{"r":["22","23","24","25","26","27"],"h":"13:00","diaria":"24%","meal":"1"},"D2":{"r":["8","9","10","11","12","13"],"h":"11:25","diaria":"24%","meal":"1"},"D3":{"r":["28","29","30","31"],"h":"13:20","diaria":"24%","meal":"1"},"D4":{"r":["40","41","42","43","44","45","46","47","48","49"],"h":"13:15","diaria":"24%","meal":"1"},"T1":{"r":["201T","202T","203T","204T","205T","206T","207T","208T","209T","210T","211T","212T","213T","214T","215T","216T","217T","218T"],"h":"13:35","diaria":"24%","meal":"1"},"T2":{"r":["231T","232T","233T","234T","235T","236T","237T","238T","239T","240T","241T","242T","243T","244T","245T","246T"],"h":"12:29","diaria":"24%","meal":"1"},"M1":{"r":["91","92","93","95","96","97","98"],"h":"13:30","diaria":"24%","meal":"1"},"R1":{"r":["5","6"],"h":"13:15","diaria":"24%","meal":"1"},"R2":{"r":["61","62","63","64","65","66","67","68","69","70"],"h":"13:15","diaria":"24%","meal":"1"},"R3":{"r":["71","72","73","74","75","76","77","78"],"h":"12:20","diaria":"24%","meal":"1"},"R4":{"r":["81","82","83","84","85","86","87","88","89","90"],"h":"12:40","diaria":"24%","meal":"1"},"CAR1":{"r":["151","152","153","155","156"],"h":"12:10","diaria":"24%","meal":"1"},"P1":{"r":["2","3"],"h":"12:45","diaria":"24%","meal":"1"},"P2":{"r":["14","15","16","17","18","19"],"h":"13:05","diaria":"24%","meal":"1"},"P3":{"r":["33","34","35","36","37","38","39"],"h":"12:55","diaria":"24%","meal":"1"},"CAP1":{"r":["159","160","161","162","163"],"h":"12:55","diaria":"24%","meal":"1"},"SR1":{"r":["110","111","112","113","114"],"h":"12:15","diaria":"24%","meal":"1"}}};
    
    data.services.push(
      {r:"201",s:"T1",d:"S",p:[[14,480],[10,510]]},
      {r:"202",s:"T1",d:"N",p:[[10,515],[14,545]]},
      {r:"203",s:"T1",d:"S",p:[[14,550],[10,580]]},
      {r:"204",s:"T1",d:"N",p:[[10,585],[14,615]]},
      {r:"205",s:"T1",d:"S",p:[[14,625],[10,655]]},
      {r:"206",s:"T1",d:"N",p:[[10,665],[14,695]]},
      {r:"207",s:"T1",d:"S",p:[[14,705],[10,735]]},
      {r:"208",s:"T1",d:"N",p:[[10,745],[14,780]]},
      {r:"209",s:"T1",d:"S",p:[[14,840],[10,870]]},
      {r:"210",s:"T1",d:"N",p:[[10,880],[14,910]]},
      {r:"211",s:"T1",d:"S",p:[[14,920],[10,950]]},
      {r:"212",s:"T1",d:"N",p:[[10,960],[14,990]]},
      {r:"213",s:"T1",d:"S",p:[[14,1000],[10,1030]]},
      {r:"214",s:"T1",d:"N",p:[[10,1040],[14,1070]]},
      {r:"215",s:"T1",d:"S",p:[[14,1080],[10,1110]]},
      {r:"216",s:"T1",d:"N",p:[[10,1120],[14,1150]]},
      {r:"217",s:"T1",d:"S",p:[[14,1155],[10,1185]]},
      {r:"218",s:"T1",d:"N",p:[[10,1190],[14,1220]]},
      {r:"231",s:"T2",d:"S",p:[[14,515],[10,545]]},
      {r:"232",s:"T2",d:"N",p:[[10,550],[14,580]]},
      {r:"233",s:"T2",d:"S",p:[[14,585],[10,615]]},
      {r:"234",s:"T2",d:"N",p:[[10,625],[14,655]]},
      {r:"235",s:"T2",d:"S",p:[[14,665],[10,695]]},
      {r:"236",s:"T2",d:"N",p:[[10,705],[14,735]]},
      {r:"237",s:"T2",d:"S",p:[[14,745],[10,780]]},
      {r:"238",s:"T2",d:"N",p:[[10,840],[14,870]]},
      {r:"239",s:"T2",d:"S",p:[[14,880],[10,910]]},
      {r:"240",s:"T2",d:"N",p:[[10,920],[14,950]]},
      {r:"241",s:"T2",d:"S",p:[[14,960],[10,990]]},
      {r:"242",s:"T2",d:"N",p:[[10,1000],[14,1030]]},
      {r:"243",s:"T2",d:"S",p:[[14,1040],[10,1070]]},
      {r:"244",s:"T2",d:"N",p:[[10,1080],[14,1110]]},
      {r:"245",s:"T2",d:"S",p:[[14,1120],[10,1150]]},
      {r:"246",s:"T2",d:"N",p:[[10,1155],[14,1185]]}
    );

    const removedStopIndex = data.stops.indexOf("LIMONE multipiano");
    if (removedStopIndex >= 0) {
      data.stops.splice(removedStopIndex, 1);
      data.services.forEach((service) => {
        service.p = service.p
          .filter(([stop]) => stop !== removedStopIndex)
          .map(([stop, minute]) => [
            stop > removedStopIndex ? stop - 1 : stop,
            minute
          ]);
      });
    }

    const shortenedStopNames = {
      "MANERBA (Dusano)": "MANERBA",
      "ASSENZA di Brenzone": "ASSENZA",
      "CAMPIONE (Tremosine)": "CAMPIONE",
      "MALCESINE centro": "MALCESINE",
      "LIMONE centro": "LIMONE"
    };
    data.stops = data.stops.map((stop) => shortenedStopNames[stop] || stop);

    const ORARI_OVERRIDE_KEY = shared.OVERRIDES_STORAGE_KEY || "navi.orari.tabella.overrides.v1";
    const parseOverrideTime = shared.parseOverrideTime || function(value) {
      const normalized = String(value || "").trim().replace(".", ":");
      const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };

    function applySharedOrariOverrides() {
      let overrides = {};
      try {
        overrides = shared.loadOverrides
          ? shared.loadOverrides()
          : (() => {
            if (typeof window === "undefined" || !window.localStorage) return {};
            const raw = window.localStorage.getItem(ORARI_OVERRIDE_KEY);
            if (!raw || raw === "null") return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
          })();
      } catch (e) {
        console.warn("Storage bloccato da iOS/Brave, uso dati di default");
        overrides = {};
      }
      
      if (!overrides || typeof overrides !== "object") overrides = {};

      Object.entries(overrides).forEach(([key, value]) => {
        const parts = key.split("|");
        if (parts.length < 3) return;
        const direction = parts[0];
        const race = parts[1];
        const stopRaw = parts[2];
        const stopIndex = parseInt(stopRaw, 10);
        const minute = parseOverrideTime(value);
        if (minute == null || Number.isNaN(stopIndex)) return;
        const service = data.services.find((item) => item.d === direction && String(item.r) === String(race));
        if (!service) return;
        const point = service.p.find((entry) => entry[0] === stopIndex);
        if (point) point[1] = minute;
        else {
          service.p.push([stopIndex, minute]);
          service.p.sort((a, b) => a[1] - b[1]);
        }
      });
    }
    applySharedOrariOverrides();

    const officialConnections = [
      {from:["22"], stop:"GARDA", at:600, to:[["2",615]]},
      {from:["22"], stop:"RIVA", at:840, to:[["75",870]]},
      {from:["24"], stop:"MALCESINE", at:845, to:[["84",850],["66",870]]},
      {from:["25"], stop:"GARDA", at:1005, to:[["13",1015]]},
      {from:["25"], stop:"SIRMIONE", at:1075, to:[["48",1115]]},
      {from:["25"], stop:"MANERBA", at:1138, to:[["49",1138]]},
      {from:["8"], stop:"SIRMIONE", at:520, to:[["110",550]]},
      {from:["8"], stop:"GARDA", at:575, to:[["160",591]]},
      {from:["12"], stop:"GARDA", at:995, to:[["156",1034]]},
      {from:["28"], stop:"SALÒ", at:577, to:[["110",609]]},
      {from:["41","42"], stop:"GARDA", at:660, to:[["24",746]]},
      {from:["44"], stop:"SIRMIONE", at:900, to:[["6",922],["162",937]]},
      {from:["2"], stop:"RIVA", at:840, to:[["75",870]]},
      {from:["3"], stop:"GARDA", at:1142, to:[["27",1150]]},
      {from:["14"], stop:"GARDA", at:540, to:[["110",571]]},
      {from:["16"], stop:"GARDA", at:711, to:[["24",746]]},
      {from:["36"], stop:"SIRMIONE", at:836, to:[["112",881]]},
      {from:["36"], stop:"GARDA", at:925, to:[["6",967],["162",971]]},
      {from:["161"], stop:"SIRMIONE", at:932, to:[["45",962],["46",1018]]},
      {from:["162"], stop:"LIMONE", at:1035, to:[["88",1080]]},
      {from:["163"], stop:"GARDA", at:1135, to:[["3",1142],["27",1150]]},
      {from:["110"], stop:"MALCESINE", at:655, to:[["82",660]]},
      {from:["111"], stop:"GARDA", at:749, to:[["153",808]]},
      {from:["112"], stop:"MALCESINE", at:969, to:[["3",975],["97",1012],["87",1020]]},
      {from:["112"], stop:"RIVA", at:1005, to:[["77",1010]]},
      {from:["113"], stop:"LIMONE", at:1030, to:[["163",1040]]},
      {from:["113"], stop:"SALÒ", at:1087, to:[["3",1088]]},
      {from:["5"], stop:"GARDA", at:770, to:[["153",808]]},
      {from:["6"], stop:"SIRMIONE", at:922, to:[["162",937]]},
      {from:["63"], stop:"MALCESINE", at:675, to:[["111",681]]},
      {from:["64"], stop:"RIVA", at:755, to:[["161",805]]},
      {from:["65"], stop:"MALCESINE", at:870, to:[["25",905]]},
      {from:["66"], stop:"RIVA", at:945, to:[["113",1005]]},
      {from:["66","67"], stop:"MALCESINE", at:995, to:[["97",1012]]},
      {from:["75"], stop:"MALCESINE", at:945, to:[["3",975]]},
      {from:["81"], stop:"MALCESINE", at:625, to:[["93",680]]},
      {from:["82"], stop:"MALCESINE", at:660, to:[["93",680],["111",681]]},
      {from:["85"], stop:"MALCESINE", at:895, to:[["25",905]]},
      {from:["151"], stop:"GARDA", at:655, to:[["43",660],["29",663],["35",670]]},
      {from:["153"], stop:"SIRMIONE", at:865, to:[["112",881]]},
      {from:["91","92"], stop:"LIMONE", at:660, to:[["82",680]]},
      {from:["96"], stop:"LIMONE", at:990, to:[["68",1018]]},
      {from:["97"], stop:"GARDA", at:1105, to:[["3",1142],["27",1150]]},

      {from:["8","28","14"], stop:"MALCESINE", at:655,
        to:[["82",660],["64",675]]},
      {from:["41","42","16"], stop:"MALCESINE", at:845,
        to:[["84",850],["66",870]]},
      {from:["44","36","6"], stop:"LIMONE", at:1035, to:[["88",1080]]},
      {from:["44","36","6"], stop:"RIVA", at:1115, to:[["89",1120]]},
      {from:["36","153"], stop:"RIVA", at:1005, to:[["77",1010]]},
      {from:["161","64"], stop:"SIRMIONE", at:932,
        to:[["45",962],["46",1018]]},
      {from:["161","64"], stop:"MANERBA", at:1041, to:[["47",1041]]},
      {from:["162"], stop:"RIVA", at:1115, to:[["89",1120]]},
      {from:["113"], stop:"GARDA", at:1135, to:[["3",1142]]},
      {from:["63","82"], stop:"GARDA", at:749, to:[["153",808]]},
      {from:["65","85"], stop:"GARDA", at:1005, to:[["13",1015]]},
      {from:["65","85"], stop:"SIRMIONE", at:1075, to:[["48",1115]]},
      {from:["65","85"], stop:"MANERBA", at:1138, to:[["49",1138]]},
      {from:["66"], stop:"SALÒ", at:1087, to:[["3",1088]]},
      {from:["66","67"], stop:"GARDA", at:1105,
        to:[["3",1142],["27",1150]]},
      {from:["75"], stop:"GARDA", at:1142, to:[["27",1150]]},
      {from:["91","92","110"], stop:"RIVA", at:715, to:[["83",720]]}
    ];

    window.NaviOrarioDataset = { data, officialConnections };

    if (!root) return;

    const ns = "http://www.w3.org/2000/svg";
    let activePath = null;
    let activeCourseIndex = -1;
    let visibleCourseEntries = [];
    let chartZoom = 1;
    let chartBaseWidth = 736;
    let chartBaseHeight = 720;
    let selectedStopFilter = null;
    let chartScales = null;
    const selectedRoutes = new Map();
    let visibleServices = [];
    let previewRouteKey = null;
    let suppressPillClick = false;
    let suppressTurniClick = false;
    let pendingRouteTap = null;
    const MOBILE_TAP_DELAY = 280;
    const MOBILE_TAP_MOVE_THRESHOLD = 10;
    const MIN_CHART_ZOOM = 0.5;
    const MAX_CHART_ZOOM = 3;
    const VIEWPORT_EDGE_PADDING = 10;

    function eventPoint(event) {
      if (event.touches && event.touches.length) {
        return {x: event.touches[0].clientX, y: event.touches[0].clientY};
      }
      if (event.changedTouches && event.changedTouches.length) {
        return {x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY};
      }
      if (event.clientX != null && event.clientY != null) {
        return {x: event.clientX, y: event.clientY};
      }
      return null;
    }

    function readDragOffset(element) {
      return {
        x: Number.parseFloat(element.dataset.dragX || "0") || 0,
        y: Number.parseFloat(element.dataset.dragY || "0") || 0
      };
    }

    function setDragOffset(element, x, y) {
      element.dataset.dragX = String(x);
      element.dataset.dragY = String(y);
      element.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    }

    function clampElementToViewport(element, padding = VIEWPORT_EDGE_PADDING) {
      if (!element || element.hidden) return;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const rect = element.getBoundingClientRect();
      let adjustX = 0;
      let adjustY = 0;
      const rightLimit = viewportWidth - padding;
      const bottomLimit = viewportHeight - padding;
      if (rect.left < padding) adjustX = padding - rect.left;
      else if (rect.right > rightLimit) adjustX = rightLimit - rect.right;
      if (rect.top < padding) adjustY = padding - rect.top;
      else if (rect.bottom > bottomLimit) adjustY = bottomLimit - rect.bottom;
      if (!adjustX && !adjustY) return;
      const offset = readDragOffset(element);
      setDragOffset(element, offset.x + adjustX, offset.y + adjustY);
    }

    function clearPendingRouteTap() {
      if (!pendingRouteTap) return;
      clearTimeout(pendingRouteTap.timer);
      pendingRouteTap = null;
    }

    function scheduleRouteSingleTap(routeKeyValue, callback) {
      clearPendingRouteTap();
      pendingRouteTap = {
        key: routeKeyValue,
        timer: setTimeout(() => {
          const task = pendingRouteTap;
          pendingRouteTap = null;
          if (!task || task.key !== routeKeyValue) return;
          callback();
        }, MOBILE_TAP_DELAY)
      };
    }

    function consumeRouteDoubleTap(routeKeyValue) {
      if (!pendingRouteTap || pendingRouteTap.key !== routeKeyValue) return false;
      clearPendingRouteTap();
      return true;
    }

    function syncResidencesDragPosition() {
      if (!residences) return;
      const dragOffset = readDragOffset(residences);
      if (!isMobileLayout() && chartWrap && residences.parentElement === chartWrap) {
        residences.style.transform = "translate(" + (chartWrap.scrollLeft + dragOffset.x) + "px," +
          (chartWrap.scrollTop + dragOffset.y) + "px)";
      } else if (dragOffset.x || dragOffset.y) {
        residences.style.transform = "translate3d(" + dragOffset.x + "px," + dragOffset.y + "px,0)";
      } else {
        residences.style.transform = "";
      }
    }

    function enableDrag(element, options = {}) {
      if (!element) return;
      let state = null;

      const move = (event) => {
        if (!state) return;
        const point = eventPoint(event);
        if (!point) return;
        const deltaX = point.x - state.startX;
        const deltaY = point.y - state.startY;
        if (!state.moved && Math.hypot(deltaX, deltaY) < 4) return;
        state.moved = true;
        setDragOffset(element, state.baseX + deltaX, state.baseY + deltaY);
        if (typeof options.onMove === "function") options.onMove(event);
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      };

      const end = (event) => {
        if (!state) return;
        const moved = state.moved;
        state = null;
        document.removeEventListener("mousemove", move, true);
        document.removeEventListener("touchmove", move, true);
        document.removeEventListener("mouseup", end, true);
        document.removeEventListener("touchend", end, true);
        document.removeEventListener("touchcancel", end, true);
        if (typeof options.onEnd === "function") options.onEnd(moved, event);
        if (event && event.cancelable) event.preventDefault();
        if (event) event.stopPropagation();
      };

      const start = (event) => {
        if (typeof options.shouldStart === "function" && !options.shouldStart(event)) return;
        const point = eventPoint(event);
        if (!point) return;
        const offset = readDragOffset(element);
        state = {
          startX: point.x,
          startY: point.y,
          baseX: offset.x,
          baseY: offset.y,
          moved: false
        };
        document.addEventListener("mousemove", move, true);
        document.addEventListener("touchmove", move, {passive: false, capture: true});
        document.addEventListener("mouseup", end, true);
        document.addEventListener("touchend", end, true);
        document.addEventListener("touchcancel", end, true);
        if (typeof options.onStart === "function") options.onStart(event);
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      };

      element.addEventListener("mousedown", start);
      element.addEventListener("touchstart", start, {passive: false});
    }

    const shiftOrder = Object.keys(data.shifts).filter((shift) =>
      data.services.some((service) => service.s === shift)
    );

    const residenceOrder = [
      ["Desenzano", ["D1", "D2", "D3", "D4"]],
      ["Peschiera", ["P1", "P2", "P3", "CAP1", "SR1"]],
      ["Maderno", ["T1", "T2", "M1"]],
      ["Riva", ["R1", "R2", "R3", "R4", "CAR1"]]
    ].map(([name, shifts]) => [name, shifts.filter((shift) => shiftOrder.includes(shift))])
      .filter(([, shifts]) => shifts.length);

    const shiftColorMap = shared.SHIFT_COLOR_MAP || {
      D1: "#3b82f6", D2: "#10b981", D3: "#f97316", D4: "#d946ef",
      P1: "#06b6d4", P2: "#84cc16", P3: "#ef4444", CAP1: "#a78bfa",
      SR1: "#eab308", T1: "#2563eb", T2: "#14b8a6", M1: "#f59e0b",
      R1: "#8b5cf6", R2: "#22c55e", R3: "#f43f5e", R4: "#ec4899",
      CAR1: "#64748b"
    };

    const residenceColorMap = {
      Desenzano: "#22d3ee", Peschiera: "#34d399",
      Maderno: "#fb923c", Riva: "#c084fc"
    };

    const residenceShortMap = {
      Desenzano: "D", Peschiera: "P", Maderno: "M", Riva: "R"
    };

    if (residences) {
      residences.innerHTML = residenceOrder.map(([name, shifts]) =>
        '<section class="og-residence" style="--residence-color:' +
        residenceColorMap[name] + '">' +
        '<button class="btn og-residence-name" type="button" data-residence="' + name +
        '" aria-pressed="true" style="--residence-color:' + residenceColorMap[name] +
        '" aria-label="Mostra o nascondi tutti i turni della residenza ' + name + '">' +
        residenceShortMap[name] + "</button>" +
        '<div class="og-residence-shifts">' +
        shifts.map((shift) =>
          '<div class="og-shift-row">' +
          '<button class="btn og-shift-button" type="button" data-shift="' + shift +
          '" aria-pressed="true" style="--shift-color:' +
          shiftColorMap[shift] + '">' +
          shift + "</button>" +
          '<button class="btn og-shift-expand" type="button" data-shift="' + shift +
          '" aria-expanded="false" aria-label="Espandi le corse del turno ' + shift +
          '" style="--shift-color:' + shiftColorMap[shift] + '">›</button>' +
          '<div class="og-race-list" data-shift="' + shift + '" hidden style="--shift-color:' +
          shiftColorMap[shift] + '">' +
          data.shifts[shift].r.slice().sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map((race) =>
              '<button class="btn og-race-button" type="button" data-shift="' + shift +
              '" data-race="' + race + '" data-route-key="' + shift + ":" + race +
              '" aria-pressed="false" style="--shift-color:' + shiftColorMap[shift] + '">' +
              race + '<span class="og-race-check" aria-hidden="true">✓</span></button>'
            ).join("") +
          "</div>" +
          "</div>"
        ).join("") +
        "</div>" +
        "</section>"
      ).join("");
      residences.insertAdjacentHTML("beforeend",
        '<div class="og-menu-actions" aria-label="Visibilità di tutte le corse">' +
        '<button class="btn og-menu-action og-menu-master" type="button" ' +
        'aria-pressed="true" aria-label="Nascondi tutte le corse">Ness.</button>' +
        "</div>"
      );
    }

    const rapidRaces = new Set([
      "110", "111", "112", "113", "114",
      "151", "155", "156", "160", "161", "162", "163"
    ]);

    function selectedShifts() {
      return new Set(
        Array.from(root.querySelectorAll(".og-shift-button[aria-pressed='true']"),
          (button) => button.dataset.shift)
      );
    }

    function isLandscapeTouchLayout() {
      return window.matchMedia("(pointer: coarse) and (orientation: landscape)").matches;
    }

    function getChartLeftMargin(baseWidth) {
      if (isMobileLayout()) {
        if (isLandscapeTouchLayout()) {
          if (baseWidth <= 720) return 78;
          if (baseWidth <= 920) return 88;
          return 96;
        }
        if (baseWidth <= 420) return 84;
        if (baseWidth <= 520) return 96;
        return 104;
      }
      if (baseWidth <= 420) return 84;
      if (baseWidth <= 520) return 96;
      if (baseWidth < 680) return 118;
      if (baseWidth < 980) return 154;
      return 168;
    }

    function isMobileLayout() {
      return window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    }

    function isTurniMenuOpen() {
      if (isMobileLayout()) return root.classList.contains("og-mobile-menu-open");
      return !root.classList.contains("og-turns-hidden");
    }

    function syncTurniMenuToggle() {
      if (!mobileMenuToggle) return;
      const open = isTurniMenuOpen();
      mobileMenuToggle.setAttribute("aria-expanded", String(open));
      mobileMenuToggle.classList.toggle("is-active", open);
    }

    function setTurniMenuOpen(open) {
      if (isMobileLayout()) {
        root.classList.toggle("og-mobile-menu-open", open);
        root.classList.remove("og-turns-hidden");
        syncTurniMenuToggle();
        return;
      }
      root.classList.remove("og-mobile-menu-open");
      root.classList.toggle("og-turns-hidden", !open);
      syncTurniMenuToggle();
    }

    function closeMobileMenu() {
      setTurniMenuOpen(false);
    }

    function selectOnly(shifts) {
      const wanted = new Set(shifts);
      root.querySelectorAll(".og-shift-button").forEach((button) => {
        button.setAttribute("aria-pressed", String(wanted.has(button.dataset.shift)));
      });
      draw();
    }

    function showPage(page) {
      const chartSelected = page === "chart";
      if (pageChart) pageChart.hidden = !chartSelected;
      if (pageMatrix) pageMatrix.hidden = chartSelected;
      if (tabChart) {
        tabChart.classList.toggle("btn-primary", chartSelected);
        tabChart.setAttribute("aria-selected", String(chartSelected));
      }
      if (tabMatrix) {
        tabMatrix.classList.toggle("btn-primary", !chartSelected);
        tabMatrix.setAttribute("aria-selected", String(!chartSelected));
      }
      if (!chartSelected && courseCard && courseCard.open && typeof courseCard.close === "function") {
        courseCard.close();
      }
    }

    function formatAverage(minutes) {
      if (!minutes.length) return "—";
      const value = Math.round(minutes.reduce((sum, item) => sum + item, 0) / minutes.length);
      return value >= 60
        ? Math.floor(value / 60) + "h" + String(value % 60).padStart(2, "0") + "m"
        : value + "m";
    }

    function durationsBetween(origin, destination, rapid) {
      const durations = [];
      data.services.forEach((service) => {
        if (rapidRaces.has(service.r) !== rapid) return;
        const originCalls = service.p.filter((point) => point[0] === origin);
        const destinationCalls = service.p.filter((point) => point[0] === destination);
        originCalls.forEach((from) => destinationCalls.forEach((to) => {
          if (to[1] > from[1]) durations.push(to[1] - from[1]);
        }));
      });
      return durations;
    }

    function drawOneMatrix(table, rapid) {
      if (!table) return;
      const thead = table.querySelector("thead");
      const tbody = table.querySelector("tbody");
      if (!thead || !tbody) return;
      
      thead.innerHTML = "<tr><th>Da / a</th>" +
        data.stops.map((stop) => '<th class="text-nowrap">' + stop + "</th>").join("") +
        "</tr>";
      tbody.innerHTML = data.stops.map((origin, originIndex) => {
        const cells = data.stops.map((destination, destinationIndex) => {
          if (originIndex === destinationIndex) return "<td>—</td>";
          const durations = durationsBetween(originIndex, destinationIndex, rapid);
          if (!durations.length) return "<td>—</td>";
          const value = formatAverage(durations);
          const label = origin + " - " + destination + ": " + value;
          return '<td aria-label="' + label + '">' + value + "</td>";
        }).join("");
        return '<tr><td class="text-nowrap">' + origin + "</td>" + cells + "</tr>";
      }).join("");
      table.querySelectorAll("tbody td:not(:first-child)").forEach((cell) => {
        cell.addEventListener("mouseenter", () => {
          table.querySelectorAll(".is-highlighted").forEach((item) =>
            item.classList.remove("is-highlighted")
          );
          const row = cell.parentElement;
          const column = Array.from(row.children).indexOf(cell);
          cell.classList.add("is-highlighted");
          if (row.firstElementChild) row.firstElementChild.classList.add("is-highlighted");
          const theadRow = table.querySelector("thead tr");
          if (theadRow && theadRow.children[column]) {
            theadRow.children[column].classList.add("is-highlighted");
          }
        });
        cell.addEventListener("mouseleave", () => {
          table.querySelectorAll(".is-highlighted").forEach((item) =>
            item.classList.remove("is-highlighted")
          );
        });
      });
    }

    function drawTravelMatrices() {
      drawOneMatrix(normalMatrix, false);
      drawOneMatrix(rapidMatrix, true);
    }

    function node(name, attrs, text) {
      const element = document.createElementNS(ns, name);
      Object.entries(attrs || {}).forEach(([key, value]) => element.setAttribute(key, value));
      if (text !== undefined) element.textContent = text;
      return element;
    }

    const formatTime = shared.formatTime
      ? (minutes) => shared.formatTime(minutes, "--:--")
      : function(minutes) {
        if (minutes == null || isNaN(minutes)) return "--:--";
        return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" +
          String(minutes % 60).padStart(2, "0");
      };

    function routeText(service) {
      if (!service || !service.p) return "";
      const calls = service.p.map(([stop, minute]) =>
        (data.stops[stop] || "Stop") + " " + formatTime(minute)
      );
      const direction = service.s === "T1" || service.s === "T2"
        ? "servizio traghetto"
        : service.d === "N" ? "verso Riva" : "verso Desenzano/Peschiera";
      return service.s + " · corsa " + service.r + " · " + direction + " · " + calls.join(" → ");
    }

    function hexToRgba(hex, alpha) {
      const normalized = String(hex || "").trim().replace("#", "");
      const safe = normalized.length === 3
        ? normalized.split("").map((char) => char + char).join("")
        : normalized;
      if (!/^[0-9a-fA-F]{6}$/.test(safe)) return "rgba(16, 39, 51, " + alpha + ")";
      const intValue = Number.parseInt(safe, 16);
      const r = (intValue >> 16) & 255;
      const g = (intValue >> 8) & 255;
      const b = intValue & 255;
      return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    }

    function escapeHtml(value) {
      const valStr = value !== null && value !== undefined ? value : "";
      return String(valStr)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function prettyStopName(stop) {
      const raw = typeof stop === "number" ? data.stops[stop] : stop;
      const valStr = raw !== null && raw !== undefined ? raw : "";
      return String(valStr)
        .toLocaleLowerCase("it")
        .replace(/(^|[\s\-/'’(]+)([a-zàèéìòù])/giu,
          (match, prefix, letter) => prefix + letter.toLocaleUpperCase("it"));
    }

    function orderedCoursePoints(service) {
      return (service && service.p) ? service.p.slice().sort((a, b) => a[1] - b[1]) : [];
    }

    function positionTooltipNearPointer(event) {
      if (!tooltip || tooltip.hidden) return;
      const offset = 14;
      const edgePadding = VIEWPORT_EDGE_PADDING;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      requestAnimationFrame(() => {
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        let left = event.clientX + offset;
        let top = event.clientY + offset;
        if (left + tw > viewportWidth - edgePadding) {
          left = event.clientX - tw - offset;
        }
        if (top + th > viewportHeight - edgePadding) {
          top = event.clientY - th - offset;
        }
        left = Math.max(edgePadding, Math.min(left, viewportWidth - tw - edgePadding));
        top = Math.max(edgePadding, Math.min(top, viewportHeight - th - edgePadding));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      });
    }

    function showTooltip(html, event, color = "#2dd4bf") {
      if (!tooltip) return;
      tooltip.hidden = false;
      tooltip.style.setProperty("--tooltip-color", color);
      tooltip.style.setProperty("--tooltip-bg", hexToRgba(color, 0.16));
      tooltip.style.setProperty("--tooltip-border", hexToRgba(color, 0.4));
      tooltip.innerHTML = html;
      positionTooltipNearPointer(event);
    }

    function hideTooltip() {
      if (tooltip) tooltip.hidden = true;
    }

    function clearRoutePreview() {
      previewRouteKey = null;
      root.querySelectorAll(".og-route.is-active").forEach((item) => {
        if (!selectedRoutes.has(item.dataset.routeKey)) item.classList.remove("is-active");
      });
      if (!selectedRoutes.size) clearStopRouteHighlight();
      hideTooltip();
    }

    function previewRoute(path, service, color, event, sortedPoints) {
      previewRouteKey = routeKey(service);
      root.querySelectorAll(".og-route.is-active").forEach((item) => {
        if (!selectedRoutes.has(item.dataset.routeKey)) item.classList.remove("is-active");
      });
      if (path) path.classList.add("is-active");
      if (!selectedRoutes.size) highlightRouteStops(service, color, true);
      
      let anchorStop = 0;
      if (sortedPoints && sortedPoints[0] && sortedPoints[0][0] !== undefined) {
        anchorStop = sortedPoints[0][0];
      } else if (service.p && service.p[0] && service.p[0][0] !== undefined) {
        anchorStop = service.p[0][0];
      }

      if (!chartWrap) return;
      const rect = chartWrap.getBoundingClientRect();
      const baseWidth = Math.max(320, Math.round(root.getBoundingClientRect().width || 736));
      const labelX = getChartLeftMargin(baseWidth) + 8;
      const fallbackEvent = isMobileLayout()
        ? {
            clientX: rect.left + Math.max(12, labelX - chartWrap.scrollLeft),
            clientY: rect.top + Math.max(92, (chartScales ? chartScales.y(anchorStop) : 110) - chartWrap.scrollTop - 10)
          }
        : (event && event.clientX != null ? event : {
            clientX: rect.left + 12,
            clientY: rect.top + Math.max(90, chartScales ? chartScales.y(anchorStop) - chartWrap.scrollTop : 110)
          });
      showTooltip(
        '<span class="og-tooltip-label">' +
          escapeHtml(service.s + " · corsa " + service.r) +
        '</span>' +
        '<span class="og-tooltip-line">' +
          escapeHtml(prettyStopName(sortedPoints[0][0]) + " " + formatTime(sortedPoints[0][1])) +
        '</span>' +
        '<span class="og-tooltip-line">' +
          escapeHtml(prettyStopName(sortedPoints[sortedPoints.length - 1][0]) + " " +
            formatTime(sortedPoints[sortedPoints.length - 1][1])) +
        '</span>',
        fallbackEvent,
        color
      );
    }

    function courseBadgeText(service) {
      const ordered = orderedCoursePoints(service);
      if (!ordered.length) return "—";
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      return service.s + " · corsa " + service.r + " · " +
        formatTime(first[1]) + "-" + formatTime(last[1]);
    }

    function coursePillMarkup(service) {
      const ordered = orderedCoursePoints(service);
      if (!ordered.length) return "";
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const courseColor = shiftColorMap[service.s] || "#2dd4bf";
      return '<div class="og-selected-course-pill" data-route-key="' +
        escapeHtml(routeKey(service)) + '" style="' +
        '--pill-color:' + courseColor + ';' +
        '--pill-bg:' + hexToRgba(courseColor, 0.18) + ';' +
        '--pill-border:' + hexToRgba(courseColor, 0.42) + ';">' +
        '<span class="og-selected-course-pill-label">' +
        escapeHtml(service.s + " · corsa " + service.r) +
        '</span>' +
        '<span class="og-selected-course-pill-line">' +
        escapeHtml(prettyStopName(first[0]) + " " + formatTime(first[1])) +
        '</span>' +
        '<strong class="og-selected-course-pill-value">' +
        escapeHtml(prettyStopName(last[0]) + " " + formatTime(last[1])) +
        '</strong>' +
        '</div>';
    }

    function getSelectedCoincidencePills() {
      if (!coincidenceToggle || coincidenceToggle.getAttribute("aria-pressed") !== "true") return [];
      const selectedServices = Array.from(selectedRoutes.values(), (entry) => entry.service);
      const selectedRaces = new Set(selectedServices.map((service) => service.r));
      const routeLevels = new Map();
      const incomingSelectedTargets = new Set();
      officialConnections.forEach((connection) => {
        connection.to.forEach(([targetRace]) => {
          if (selectedRaces.has(targetRace) &&
              connection.from.some((race) => selectedRaces.has(race) && race !== targetRace)) {
            incomingSelectedTargets.add(targetRace);
          }
        });
      });
      const roots = selectedServices
        .filter((service) => !incomingSelectedTargets.has(service.r))
        .map((service) => service.r);
      (roots.length ? roots : selectedServices.map((service) => service.r)).forEach((race) => {
        routeLevels.set(race, 0);
      });
      const queue = Array.from(routeLevels.keys());
      while (queue.length) {
        const race = queue.shift();
        const level = routeLevels.get(race) || 0;
        officialConnections.forEach((connection) => {
          if (!connection.from.includes(race)) return;
          connection.to.forEach(([targetRace]) => {
            if (!selectedRaces.has(targetRace)) return;
            const nextLevel = level + 1;
            if (!routeLevels.has(targetRace) || nextLevel < routeLevels.get(targetRace)) {
              routeLevels.set(targetRace, nextLevel);
              queue.push(targetRace);
            }
          });
        });
      }
      const rendered = new Set();
      const pills = [];
      officialConnections.forEach((connection) => {
        const sourceRace = connection.from
          .filter((race) => selectedRaces.has(race))
          .sort((a, b) => (routeLevels.get(a) || 0) - (routeLevels.get(b) || 0))[0];
        if (!sourceRace) return;
        const sourceService = data.services.find((service) => service.r === sourceRace);
        if (!sourceService) return;
        const sourceLevel = routeLevels.get(sourceRace) || 0;
        connection.to.forEach(([targetRace, departure]) => {
          const target = data.services.find((service) => service.r === targetRace);
          if (!target) return;
          if (selectedRoutes.has(routeKey(target))) return;
          const targetLevel = sourceLevel + 1;
          const key = sourceRace + ":" + connection.stop + ":" + connection.at + ":" + targetRace;
          if (rendered.has(key)) return;
          rendered.add(key);
          const courseColor = shiftColorMap[target.s] || "#2dd4bf";
          const relationText = sourceService.s + "/" + sourceService.r + " -> " + target.s + "/" + target.r;
          const levelClass = targetLevel >= 3
            ? " og-selected-course-pill-coincidence-tertiary"
            : targetLevel === 2
              ? " og-selected-course-pill-coincidence-secondary"
              : "";
          const levelLabel = targetLevel <= 1 ? "Coincidenza" : "Coincidenza " + targetLevel + "°";
          pills.push(
            '<div class="og-selected-course-pill og-selected-course-pill-coincidence' + levelClass + '" ' +
              'data-target-race="' + escapeHtml(targetRace) + '" ' +
              'data-target-shift="' + escapeHtml(target.s) + '" ' +
              'data-level="' + escapeHtml(String(targetLevel)) + '" ' +
              'style="' +
              '--pill-color:' + courseColor + ';' +
              '--pill-bg:' + hexToRgba(courseColor, 0.16) + ';' +
              '--pill-border:' + hexToRgba(courseColor, 0.38) + ';">' +
              '<span class="og-selected-course-pill-label">' + escapeHtml(levelLabel) + '</span>' +
              '<strong class="og-selected-course-pill-value">' +
                escapeHtml(relationText) +
              '</strong>' +
              '<span class="og-selected-course-pill-line">' +
                escapeHtml(prettyStopName(connection.stop) + " " + formatTime(departure)) +
              '</span>' +
            '</div>'
          );
        });
      });
      return pills;
    }

    function renderSelectedCoursePills() {
      if (!selectedCoursePills || !selectedCoursePillList || !selectedCoincidencePillList) return;
      const services = Array.from(selectedRoutes.values(), (entry) => entry.service);
      const coincidencePills = getSelectedCoincidencePills();
      if (!services.length) {
        selectedCoursePills.hidden = true;
        selectedCoursePillList.innerHTML = "";
        selectedCoincidencePillList.innerHTML = "";
        selectedCoincidencePillList.hidden = true;
        return;
      }
      selectedCoursePills.hidden = false;
      selectedCoursePillList.innerHTML = services.map(coursePillMarkup).join("");
      selectedCoincidencePillList.innerHTML = coincidencePills.join("");
      selectedCoincidencePillList.hidden = !coincidencePills.length;
      requestAnimationFrame(() => clampElementToViewport(selectedCoursePills));
    }

    function openCoincidenceRace(targetRace, targetShift) {
      const target = data.services.find((service) =>
        service.r === targetRace && (!targetShift || service.s === targetShift)
      );
      if (!target) return;
      const shiftButton = root.querySelector('.og-shift-button[data-shift="' + target.s + '"]');
      if (shiftButton && shiftButton.getAttribute("aria-pressed") !== "true") {
        const savedLeft = chartWrap ? chartWrap.scrollLeft : 0;
        const savedTop = chartWrap ? chartWrap.scrollTop : 0;
        shiftButton.setAttribute("aria-pressed", "true");
        draw(true);
        if (chartWrap) {
          chartWrap.scrollLeft = savedLeft;
          chartWrap.scrollTop = savedTop;
        }
      }
      toggleSelectedRoute(null, target, shiftColorMap[target.s] || "#3b82f6", true);
    }

    if (selectedCoursePillList) {
      selectedCoursePillList.addEventListener("click", (event) => {
        if (suppressPillClick) {
          event.preventDefault();
          event.stopPropagation();
          suppressPillClick = false;
          return;
        }
        const coursePill = event.target.closest(".og-selected-course-pill[data-route-key]");
        if (!coursePill) return;
        const selection = selectedRoutes.get(coursePill.dataset.routeKey);
        if (!selection) return;
        toggleSelectedRoute(null, selection.service, selection.color, false);
      });
    }

    if (selectedCoincidencePillList) {
      selectedCoincidencePillList.addEventListener("click", (event) => {
        if (suppressPillClick) {
          event.preventDefault();
          event.stopPropagation();
          suppressPillClick = false;
          return;
        }
        const pill = event.target.closest(".og-selected-course-pill-coincidence");
        if (!pill) return;
        openCoincidenceRace(pill.dataset.targetRace, pill.dataset.targetShift);
      });
    }

    if (residences) {
      residences.addEventListener("click", (event) => {
        if (!suppressTurniClick) return;
        event.preventDefault();
        event.stopPropagation();
        suppressTurniClick = false;
      }, true);
    }

    enableDrag(zoomControls, {
      shouldStart: (event) => {
        if (event.type === "mousedown" && event.button !== 0) return false;
        if (event.touches && event.touches.length > 1) return false;
        if (event.target !== zoomControls) return false;
        return true;
      },
      onStart: () => {
        zoomControls.classList.add("is-dragging");
      },
      onEnd: () => {
        zoomControls.classList.remove("is-dragging");
      }
    });

    enableDrag(selectedCoursePills, {
      shouldStart: (event) => {
        if (event.type === "mousedown" && event.button !== 0) return false;
        if (event.touches && event.touches.length > 1) return false;
        return Boolean(event.target.closest(".og-selected-course-pill"));
      },
      onStart: () => {
        selectedCoursePills.classList.add("is-dragging");
      },
      onMove: () => {
        clampElementToViewport(selectedCoursePills);
      },
      onEnd: (moved) => {
        selectedCoursePills.classList.remove("is-dragging");
        clampElementToViewport(selectedCoursePills);
        if (!moved) return;
        suppressPillClick = true;
        setTimeout(() => {
          suppressPillClick = false;
        }, 140);
      }
    });

    enableDrag(residences, {
      shouldStart: (event) => {
        if (event.type === "mousedown" && event.button !== 0) return false;
        if (event.touches && event.touches.length > 1) return false;
        if (event.target !== residences) return false;
        if (event.target.closest(".og-race-list")) return false;
        return true;
      },
      onStart: () => {
        residences.classList.add("is-dragging");
      },
      onMove: () => {
        syncResidencesDragPosition();
      },
      onEnd: (moved) => {
        residences.classList.remove("is-dragging");
        syncResidencesDragPosition();
        if (!moved) return;
        suppressTurniClick = true;
        setTimeout(() => {
          suppressTurniClick = false;
        }, 160);
      }
    });

    function pauseAfter(service) {
      if (!service || !service.p) return null;
      const sequence = data.services
        .filter((item) => item.s === service.s)
        .slice()
        .sort((a, b) =>
          Math.min(...a.p.map((point) => point[1])) -
          Math.min(...b.p.map((point) => point[1]))
        );
      const index = sequence.indexOf(service);
      if (index < 0 || index === sequence.length - 1) return null;
      const current = service.p.slice().sort((a, b) => a[1] - b[1]);
      const next = sequence[index + 1].p.slice().sort((a, b) => a[1] - b[1]);
      if (!current.length || !next.length) return null;
      const arrival = current[current.length - 1];
      const departure = next[0];
      const gap = departure[1] - arrival[1];
      if (arrival[0] !== departure[0] || gap < 30) return null;
      return {
        stop: arrival[0],
        arrival: arrival[1],
        departure: departure[1],
        nextRace: sequence[index + 1].r
      };
    }

    function showCourseCard(path, service) {
      if (!courseCard) return;
      if (activePath && activePath.classList) activePath.classList.remove("is-active");
      activePath = path;
      if (activePath && activePath.classList) activePath.classList.add("is-active");
      activeCourseIndex = visibleCourseEntries.findIndex((entry) => entry.path === path);
      if (coursePrev) coursePrev.disabled = activeCourseIndex <= 0;
      if (courseNext) courseNext.disabled = activeCourseIndex < 0 || activeCourseIndex >= visibleCourseEntries.length - 1;
      
      const ordered = service.p.slice().sort((a, b) => a[1] - b[1]);
      if (!ordered.length) return;
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const duration = last[1] - first[1];
      const pause = pauseAfter(service);
      const kind = service.s === "T1" || service.s === "T2"
        ? "servizio traghetto"
        : rapidRaces.has(service.r) ? "servizio rapido" : "corsa normale";
      const courseColor = path ? (getComputedStyle(path).stroke || shiftColorMap[service.s]) : (shiftColorMap[service.s] || "#2dd4bf");
      
      if (miniChart) miniChart.style.setProperty("--course-color", courseColor);
      courseCard.style.setProperty("--course-color", courseColor);
      if (courseCode) courseCode.textContent = service.s;
      if (courseTitle) courseTitle.textContent = service.r;
      if (courseSummary) courseSummary.textContent = data.stops[first[0]] + " " + formatTime(first[1]) +
        " → " + data.stops[last[0]] + " " + formatTime(last[1]) +
        " · " + formatAverage([duration]) + " · " + kind +
        (pause ? " · sosta dopo l’arrivo a " + data.stops[pause.stop] : "");
        
      const legMinutes = ordered.slice(0, -1).map((point, index) =>
        ordered[index + 1][1] - point[1]
      );
      const rowHeights = ordered.map((point, index) => {
        const prevMin = legMinutes[index - 1];
        const currMin = legMinutes[index];
        const previous = prevMin !== undefined ? prevMin : (currMin !== undefined ? currMin : 15);
        const next = currMin !== undefined ? currMin : (prevMin !== undefined ? prevMin : 15);
        const averageLeg = (previous + next) / 2;
        return Math.max(60, Math.min(180, Math.round(averageLeg * 3)));
      });
      if (courseStopsBody) {
        courseStopsBody.innerHTML = ordered.map(([stop, minute], index) => {
          const stopPause = index === ordered.length - 1 ? pause : null;
          const time = stopPause
            ? "Arrivo " + formatTime(stopPause.arrival)
            : formatTime(minute);
          return '<tr style="height:' + rowHeights[index] + 'px"><td>' + data.stops[stop] +
            '</td><td class="text-end text-nowrap">' + time + "</td></tr>";
        }).join("");
      }
      
      if (miniChart) {
        while (miniChart.firstChild) miniChart.removeChild(miniChart.firstChild);
        const width = 92;
        const height = rowHeights.reduce((sum, value) => sum + value, 0);
        const x = 28;
        const pointYs = [];
        rowHeights.reduce((offset, rowHeight) => {
          pointYs.push(offset + rowHeight / 2);
          return offset + rowHeight;
        }, 0);
        miniChart.setAttribute("viewBox", "0 0 " + width + " " + height);
        miniChart.style.width = width + "px";
        miniChart.style.height = height + "px";
        miniChart.appendChild(node("line", {
          x1: x, x2: x,
          y1: pointYs[0], y2: pointYs[pointYs.length - 1],
          class: "og-mini-line"
        }));
        legMinutes.forEach((minutes, index) => {
          miniChart.appendChild(node("text", {
            x: 46,
            y: (pointYs[index] + pointYs[index + 1]) / 2 + 4,
            class: "og-mini-leg-time"
          }, minutes + " min"));
        });
        ordered.forEach((point, index) => {
          miniChart.appendChild(node("circle", {
            cx: x, cy: pointYs[index], r: 6, class: "og-mini-dot"
          }));
        });
      }
      
      if (!courseCard.open && typeof courseCard.showModal === "function") courseCard.showModal();
      if (detail) detail.textContent = routeText(service);
    }

    function selectRoute(path, service) {
      showCourseCard(path, service);
    }

    function routeKey(service) {
      if (!service) return "";
      return service.s + ":" + service.r;
    }

    function clearStopRouteHighlight() {
      if (!stopAxis) return;
      stopAxis.querySelectorAll(".og-axis-label").forEach((label) => {
        label.classList.remove("is-route-stop", "is-route-hidden", "is-shared-stop");
        label.style.removeProperty("--route-color");
        label.style.removeProperty("--selection-offset");
        label.querySelectorAll(".og-stop-time").forEach((time) => {
          if (time.remove) time.remove();
          else if (time.parentNode) time.parentNode.removeChild(time);
        });
      });
    }

    function highlightRouteStops(service, color, showTimes) {
      clearStopRouteHighlight();
      if (!stopAxis) return;
      service.p.slice().sort((a, b) => a[1] - b[1]).forEach(([stop, minute]) => {
        const label = stopAxis.querySelector('.og-axis-label[data-stop="' + stop + '"]');
        if (!label) return;
        label.classList.add("is-route-stop");
        label.style.setProperty("--route-color", color);
        if (showTimes) {
          const time = document.createElement("span");
          time.className = "og-stop-time";
          time.style.setProperty("--time-color", color);
          time.textContent = formatTime(minute);
          label.appendChild(time);
        }
      });
    }

    function clearSelectedRoutes() {
      selectedRoutes.clear();
      visibleServices = visibleServices.slice();
      if (svg) {
        svg.querySelectorAll(".og-coincidence-layer").forEach((item) => {
          if (item.remove) item.remove();
          else if (item.parentNode) item.parentNode.removeChild(item);
        });
      }
      root.querySelectorAll(".og-route,.og-stop-dot,.og-course-label").forEach((item) => {
        item.classList.remove("is-muted", "is-active", "is-coincidence-target");
      });
      root.querySelectorAll(".og-shift-button").forEach((button) => {
        button.classList.remove("is-route-muted", "is-route-active");
      });
      root.querySelectorAll(".og-race-button").forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
      });
      // Mostra di nuovo tutti i pastPath
      root.querySelectorAll(".og-route-past").forEach((pastPath) => {
        pastPath.style.display = "";
      });
      clearStopRouteHighlight();
      renderSelectedCoursePills();
    }

    function syncRaceMenuSelection() {
      root.querySelectorAll(".og-race-button").forEach((button) => {
        const isSelected = selectedRoutes.has(button.dataset.routeKey);
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      });
    }

    function renderCoincidences() {
      // PULIZIA: Prima controlliamo e rimuoviamo sempre le coincidenze vecchie disegnate!
      if (svg) {
        svg.querySelectorAll(".og-coincidence-layer").forEach((item) => {
          if (item.remove) item.remove();
          else if (item.parentNode) item.parentNode.removeChild(item);
        });
      }

      // CONTROLLO: Se il bottone è "spento", ci fermiamo qui senza disegnare le nuove
      if (!svg || !chartScales || !coincidenceToggle || coincidenceToggle.getAttribute("aria-pressed") !== "true") return;

      const activeShifts = Array.from(selectedShifts());
      const sourceServices = selectedRoutes.size
        ? Array.from(selectedRoutes.values(), (entry) => entry.service)
        : (activeShifts.length > 0 && activeShifts.length < shiftOrder.length
            ? visibleServices.filter((service) => activeShifts.includes(service.s))
            : []);
      if (!sourceServices.length) return;

      const selectedRaces = new Set(sourceServices.map((service) => service.r));
      const layer = node("g", {class: "og-coincidence-layer"});
      const renderedKeys = new Set();
      let rendered = 0;
      officialConnections.forEach((connection) => {
        const sourceRace = connection.from.find((race) => selectedRaces.has(race));
        if (!sourceRace) return;
        const sourceService = data.services.find((service) => service.r === sourceRace);
        if (!sourceService) return;
        const stop = data.stops.indexOf(connection.stop);
        if (stop < 0) return;
        connection.to.forEach(([targetRace, departure]) => {
          const connectionKey = connection.stop + ":" + connection.at + ":" +
            targetRace + ":" + departure;
          if (renderedKeys.has(connectionKey)) return;
          renderedKeys.add(connectionKey);
          const target = data.services.find((service) => service.r === targetRace);
          if (!target) return;
          const targetPoint = target.p.find(([pointStop, minute]) =>
            pointStop === stop && Math.abs(minute - departure) <= 3
          );
          if (!targetPoint) return;
          const x1 = chartScales.x(connection.at);
          const x2 = chartScales.x(departure);
          const y1 = chartScales.y(stop);
          const targetColor = shiftColorMap[target.s] || "#2dd4bf";
          const relationText = sourceService.s + "/" + sourceService.r + " -> " + target.s + "/" + target.r;
          const group = node("g", {
            class: "og-coincidence",
            "data-target-route": routeKey(target),
            "aria-label": relationText + " a " + connection.stop + ", attesa " +
              (departure - connection.at) + " minuti"
          });
          const line = node("line", {
            x1: x1, x2: x2, y1: y1, y2: y1,
            class: "og-coincidence-line"
          });
          line.style.stroke = targetColor;
          const hit = node("line", {
            x1: x1, x2: x2, y1: y1, y2: y1,
            class: "og-coincidence-hit"
          });
          const startRing = node("circle", {
            cx: x1, cy: y1, r: 6, class: "og-coincidence-ring"
          });
          startRing.style.stroke = targetColor;
          const endRing = node("circle", {
            cx: x2, cy: y1, r: 6, class: "og-coincidence-ring"
          });
          endRing.style.stroke = targetColor;
          const label = node("text", {
            x: (x1 + x2) / 2,
            y: y1 - 9,
            class: "og-coincidence-label"
          }, "⇄ " + sourceService.s + "/" + sourceService.r + "→" + target.s + "/" + targetRace + " · +" +
            (departure - connection.at) + "m");
          label.style.fill = targetColor;
          const selectTarget = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const hadSelection = selectedRoutes.size > 0;
            const shiftButton = root.querySelector('.og-shift-button[data-shift="' +
              target.s + '"]');
            if (shiftButton && shiftButton.getAttribute("aria-pressed") !== "true") {
              const savedLeft = chartWrap ? chartWrap.scrollLeft : 0;
              const savedTop = chartWrap ? chartWrap.scrollTop : 0;
              shiftButton.setAttribute("aria-pressed", "true");
              draw(true);
              if (chartWrap) {
                chartWrap.scrollLeft = savedLeft;
                chartWrap.scrollTop = savedTop;
              }
            }
            toggleSelectedRoute(null, target, targetColor, !hadSelection);
          };
          const showConnectionTip = (event) => {
            showTooltip(
              '<span class="og-tooltip-label">Coincidenza</span>' +
              '<span class="og-tooltip-line">' +
                escapeHtml(relationText) +
              '</span>' +
              '<span class="og-tooltip-line">' +
                escapeHtml(prettyStopName(connection.stop) + " " + formatTime(departure)) +
              '</span>',
              event,
              targetColor
            );
          };
          const hideConnectionTip = () => {
            hideTooltip();
          };
          hit.addEventListener("click", selectTarget);
          hit.addEventListener("mouseenter", showConnectionTip);
          hit.addEventListener("mousemove", showConnectionTip);
          hit.addEventListener("mouseleave", hideConnectionTip);
          group.appendChild(line);
          group.appendChild(hit);
          group.appendChild(startRing);
          group.appendChild(endRing);
          group.appendChild(label);
          if (!selectedRoutes.has(routeKey(target))) {
            const continuation = target.p.slice()
              .filter(([, minute]) => minute >= departure - 3)
              .sort((a, b) => a[1] - b[1]);
            if (continuation.length > 1) {
              const points = continuation.map(([pointStop, minute]) =>
                chartScales.x(minute) + "," + chartScales.y(pointStop)
              ).join(" ");
              const continuationLine = node("polyline", {
                points: points,
                class: "og-coincidence-continuation"
              });
              continuationLine.style.stroke = targetColor;
              continuationLine.style.color = targetColor;
              const continuationHit = node("polyline", {
                points: points,
                class: "og-coincidence-continuation-hit"
              });
              continuationHit.addEventListener("click", selectTarget);
              continuationHit.addEventListener("mouseenter", showConnectionTip);
              continuationHit.addEventListener("mousemove", showConnectionTip);
              continuationHit.addEventListener("mouseleave", hideConnectionTip);
              group.appendChild(continuationLine);
              group.appendChild(continuationHit);
            }
            continuation.forEach(([pointStop, minute]) => {
              const dot = node("circle", {
                cx: chartScales.x(minute),
                cy: chartScales.y(pointStop),
                r: 3.5,
                class: "og-coincidence-dot"
              });
              const dotHit = node("circle", {
                cx: chartScales.x(minute),
                cy: chartScales.y(pointStop),
                r: 11,
                class: "og-stop-hit"
              });
              dot.style.stroke = targetColor;
              dotHit.addEventListener("mouseenter", (event) => {
                const stopLabel = root.querySelector('.og-axis-label[data-stop="' + pointStop + '"]');
                if (stopLabel) stopLabel.classList.add("is-stop-active");
                showTooltip(
                  '<span class="og-tooltip-label">' +
                    escapeHtml(target.s + " · corsa " + targetRace) +
                  '</span>' +
                  '<span class="og-tooltip-line">' +
                    escapeHtml(prettyStopName(pointStop) + " " + formatTime(minute)) +
                  '</span>',
                  event,
                  targetColor
                );
              });
              dotHit.addEventListener("mousemove", positionTooltipNearPointer);
              dotHit.addEventListener("mouseleave", () => {
                root.querySelectorAll(".og-axis-label.is-stop-active").forEach((item) =>
                  item.classList.remove("is-stop-active")
                );
                hideTooltip();
              });
              dotHit.addEventListener("click", selectTarget);
              group.appendChild(dot);
              group.appendChild(dotHit);
              if (stopAxis) {
                const stopLabel = stopAxis.querySelector('.og-axis-label[data-stop="' + pointStop + '"]');
                if (stopLabel) {
                  stopLabel.classList.remove("is-route-hidden");
                  stopLabel.classList.add("is-route-stop");
                  if (!stopLabel.style.getPropertyValue("--route-color")) {
                    stopLabel.style.setProperty("--route-color", targetColor);
                  }
                }
              }
            });
          }
          layer.appendChild(group);
          rendered += 1;
        });
      });
      if (rendered && svg) svg.appendChild(layer);
    }

    function shouldRenderShiftCoincidences() {
      const activeShifts = selectedShifts();
      return !selectedRoutes.size && activeShifts.size > 0 && activeShifts.size < shiftOrder.length;
    }

    function layoutVisibleStopLabels() {
      if (!stopAxis) return;
      const labels = Array.from(stopAxis.querySelectorAll(".og-axis-label"))
        .filter((label) => !label.classList.contains("is-route-hidden") &&
          label.offsetHeight > 0)
        .sort((a, b) => Number(a.dataset.stop) - Number(b.dataset.stop));
      if (!labels.length) return;
      labels.forEach((label) => label.style.removeProperty("--selection-offset"));
      const items = labels.map((label) => ({
        label: label,
        desired: Number.parseFloat(label.style.top) || 0,
        height: Math.max(18, label.offsetHeight),
        center: Number.parseFloat(label.style.top) || 0
      }));
      const padding = 6;
      const topLimit = 4;
      const bottomLimit = Math.max(topLimit + 1, stopAxis.clientHeight - 4);

      items[0].center = Math.max(items[0].desired, topLimit + items[0].height / 2);
      for (let index = 1; index < items.length; index += 1) {
        const previous = items[index - 1];
        const item = items[index];
        item.center = Math.max(item.desired,
          previous.center + previous.height / 2 + item.height / 2 + padding);
      }
      const last = items[items.length - 1];
      last.center = Math.min(last.center, bottomLimit - last.height / 2);
      for (let index = items.length - 2; index >= 0; index -= 1) {
        const item = items[index];
        const next = items[index + 1];
        item.center = Math.min(item.center,
          next.center - next.height / 2 - item.height / 2 - padding);
      }
      const underflow = topLimit - (items[0].center - items[0].height / 2);
      if (underflow > 0) {
        items.forEach((item) => {
          item.center += underflow;
        });
      }
      items.forEach((item) => {
        item.label.style.setProperty("--selection-offset",
          Math.round(item.center - item.desired) + "px");
      });
    }

    function renderSelectedRoutes() {
      if (!selectedRoutes.size) {
        clearSelectedRoutes();
        return;
      }
      root.querySelectorAll(".og-route,.og-stop-dot,.og-course-label").forEach((item) => {
        const isSelected = selectedRoutes.has(item.dataset.routeKey);
        item.classList.toggle("is-muted", !isSelected);
        if (item.classList.contains("og-route")) {
          // Mantieni invariato l'aspetto della linea anche se selezionata.
          item.classList.remove("is-active");
          item.style.removeProperty("stroke-width");
          item.style.removeProperty("stroke-dasharray");
        } else {
          item.classList.toggle("is-active", isSelected);
        }
      });
      const selectedShifts = new Set(
        Array.from(selectedRoutes.values(), (entry) => entry.service.s)
      );
      root.querySelectorAll(".og-shift-button").forEach((button) => {
        const isSelectedShift = selectedShifts.has(button.dataset.shift);
        button.classList.toggle("is-route-muted", !isSelectedShift);
        button.classList.toggle("is-route-active", isSelectedShift);
      });
      // Nascondi i pastPath delle corse selezionate
      root.querySelectorAll(".og-route-past").forEach((pastPath) => {
        if (selectedRoutes.has(pastPath.dataset.routeKey)) {
          pastPath.style.display = "none";
        } else {
          pastPath.style.display = "";
        }
      });
      syncRaceMenuSelection();

      clearStopRouteHighlight();
      const stops = new Map();
      selectedRoutes.forEach(({service, color}) => {
        service.p.slice().sort((a, b) => a[1] - b[1]).forEach(([stop, minute]) => {
          if (!stops.has(stop)) stops.set(stop, []);
          stops.get(stop).push({minute, color, race: service.r});
        });
      });
      
      if (stopAxis) {
        stopAxis.querySelectorAll(".og-axis-label").forEach((label) => {
          const entries = stops.get(Number(label.dataset.stop));
          label.classList.toggle("is-route-hidden", !entries);
          if (!entries) return;
          label.classList.add("is-route-stop");
          label.classList.toggle("is-shared-stop", entries.length > 1);
          label.style.setProperty("--route-color", entries[0].color);
          const stopName = data.stops[Number(label.dataset.stop)];
          const stopOffsets = {CISANO: -20, BARDOLINO: -10, GARDA: 18};
          if (stopOffsets[stopName]) {
            label.style.setProperty("--selection-offset", stopOffsets[stopName] + "px");
          }
          entries.forEach((entry) => {
            const time = document.createElement("span");
            time.className = "og-stop-time";
            time.style.setProperty("--time-color", entry.color);
            time.textContent = entry.race + " · " + formatTime(entry.minute);
            label.appendChild(time);
          });
        });
      }
      if (detail) detail.textContent = selectedRoutes.size + (selectedRoutes.size === 1
        ? " corsa selezionata."
        : " corse selezionate · confronta gli orari nelle fermate condivise.");
      renderSelectedCoursePills();
      renderCoincidences();
      layoutVisibleStopLabels();
    }

    function zoomToSelectedRoutes() {
      if (!selectedRoutes.size || !chartWrap) return;
      const baseWidth = Math.max(320, Math.round(root.getBoundingClientRect().width || 736));
      const baseHeight = baseWidth < 520 ? 760 : 720;
      const left = getChartLeftMargin(baseWidth);
      const right = 18;
      const top = 72;
      const bottom = 18;
      const basePlotW = baseWidth - left - right;
      const basePlotH = baseHeight - top - bottom;
      const selectedServices = Array.from(selectedRoutes.values(), (entry) => entry.service);
      const points = selectedServices.flatMap((service) => service.p);
      if (!points.length) return;
      const minutes = points.map((point) => point[1]);
      const stops = points.map((point) => point[0]);
      const minMinute = Math.min(...minutes);
      const maxMinute = Math.max(...minutes);
      const minStop = Math.min(...stops);
      const maxStop = Math.max(...stops);
      const routeW = Math.max(90, ((maxMinute - minMinute) / (1245 - 450)) * basePlotW);
      const routeH = Math.max(90,
        ((maxStop - minStop) / (data.stops.length - 1)) * basePlotH);
      const availableW = Math.max(180, chartWrap.clientWidth - left - 50);
      const availableH = Math.max(180, chartWrap.clientHeight - 60);
      chartZoom = Math.max(MIN_CHART_ZOOM, Math.min(MAX_CHART_ZOOM,
        Math.min(availableW / routeW, availableH / routeH) * 0.88));
      if (zoomValue) zoomValue.textContent = Math.round(chartZoom * 100) + "%";
      draw(true);

      const plotW = basePlotW * chartZoom;
      const plotH = basePlotH * chartZoom;
      const x1 = left + ((minMinute - 450) / (1245 - 450)) * plotW;
      const x2 = left + ((maxMinute - 450) / (1245 - 450)) * plotW;
      const y1 = top + (minStop / (data.stops.length - 1)) * plotH;
      const y2 = top + (maxStop / (data.stops.length - 1)) * plotH;
      requestAnimationFrame(() => {
        chartWrap.scrollLeft = Math.max(0,
          (x1 + x2) / 2 - (left + (chartWrap.clientWidth - left) / 2));
        chartWrap.scrollTop = Math.max(0,
          (y1 + y2) / 2 - chartWrap.clientHeight / 2);
      });
    }

    function toggleSelectedRoute(path, service, color, adaptView = true) {
      const key = routeKey(service);
      if (selectedRoutes.has(key)) selectedRoutes.delete(key);
      else selectedRoutes.set(key, {service, color});
      if (selectedRoutes.size && adaptView) zoomToSelectedRoutes();
      else if (selectedRoutes.size) renderSelectedRoutes();
      else {
        clearSelectedRoutes();
        if (detail) detail.textContent = "Selezione rimossa: sono nuovamente visibili tutte le corse.";
        renderSelectedCoursePills();
      }
    }

    function draw(preserveSelections = false) {
      if (!svg) return;
      if (!preserveSelections) clearSelectedRoutes();
      while (svg.lastChild && svg.lastChild.nodeName !== "desc") {
        if (svg.removeChild) svg.removeChild(svg.lastChild);
        else break;
      }
      const selected = selectedShifts();
      const menuMaster = root.querySelector(".og-menu-master");
      if (menuMaster) {
        const anyShiftVisible = selected.size > 0;
        menuMaster.textContent = anyShiftVisible ? "Ness." : "Tutte";
        menuMaster.setAttribute("aria-pressed", String(anyShiftVisible));
        menuMaster.setAttribute("aria-label", anyShiftVisible
          ? "Nascondi tutte le corse"
          : "Mostra tutte le corse");
      }
      root.querySelectorAll(".og-residence-name").forEach((button) => {
        const residence = residenceOrder.find(([name]) => name === button.dataset.residence);
        button.setAttribute("aria-pressed",
          String(Boolean(residence && residence[1].some((shift) => selected.has(shift)))));
      });
      
      const containerWidth = Math.round(root.getBoundingClientRect().width || 736);
      const baseWidth = Math.max(isMobileLayout() ? 1100 : 736, containerWidth);
      const baseHeight = isMobileLayout() ? 780 : (baseWidth < 520 ? 760 : 720);
      
      chartBaseWidth = baseWidth;
      chartBaseHeight = baseHeight;
      
      const margin = {
        top: 72,
        right: 18,
        bottom: 18,
        left: getChartLeftMargin(baseWidth)
      };
      
      const plotW = (baseWidth - margin.left - margin.right) * chartZoom;
      const plotH = (baseHeight - margin.top - margin.bottom) * chartZoom;
      const width = margin.left + plotW + margin.right;
      const height = margin.top + plotH + margin.bottom;
      const start = 450;
      const end = 1245;
      const x = (minute) => margin.left + ((minute - start) / (end - start)) * plotW;
      const y = (stop) => margin.top + (stop / (data.stops.length - 1)) * plotH;
      chartScales = {x: x, y: y};
      
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      svg.style.width = Math.round(width) + "px";
      svg.style.height = Math.round(height) + "px";
      svg.style.minHeight = "0";
      
      if (chartStage) {
        chartStage.style.width = Math.round(width) + "px";
        chartStage.style.height = Math.round(height) + "px";
        chartStage.style.minHeight = "0";
      }
      if (stopAxis) {
        stopAxis.style.width = margin.left + "px";
        stopAxis.innerHTML = "";
      }
      if (timeAxis) {
        timeAxis.style.width = Math.round(width) + "px";
        timeAxis.innerHTML = "";
      }

      data.stops.forEach((stop, index) => {
        svg.appendChild(node("line", {
          x1: margin.left, x2: width - margin.right,
          y1: y(index), y2: y(index), class: "og-grid"
        }));
        if (stopAxis) {
          const stopLabel = document.createElement("button");
          stopLabel.type = "button";
          stopLabel.className = "og-axis-label" +
            (selectedStopFilter === index ? " is-stop-filter" : "");
          stopLabel.dataset.stop = index;
          const stopName = document.createElement("span");
          stopName.className = "og-stop-name";
          stopName.textContent = stop;
          stopLabel.appendChild(stopName);
          stopLabel.setAttribute("aria-label", "Filtra le corse che fermano a " + stop);
          stopLabel.style.top = Math.round(y(index)) + "px";
          const baseStopFont = baseWidth <= 520 ? 10 : 11;
          const maxStopFont = baseWidth <= 520 ? 16 : 20;
          stopLabel.style.fontSize = Math.max(baseStopFont,
            Math.min(maxStopFont, baseStopFont * chartZoom)) + "px";
          const toggleStopFilter = () => {
            selectedStopFilter = selectedStopFilter === index ? null : index;
            draw();
          };
          stopLabel.addEventListener("click", toggleStopFilter);
          stopAxis.appendChild(stopLabel);
        }
      });

      for (let minute = 480; minute <= 1200; minute += 30) {
        const isHour = minute % 60 === 0;
        svg.appendChild(node("line", {
          x1: x(minute), x2: x(minute),
          y1: margin.top, y2: height - margin.bottom,
          class: "og-grid" + (isHour ? " og-hour" : "")
        }));
        if (isHour && timeAxis) {
          const timeLabel = document.createElement("span");
          timeLabel.style.left = Math.round(x(minute)) + "px";
          timeLabel.textContent = formatTime(minute);
          timeAxis.appendChild(timeLabel);
        }
      }



      const visible = data.services.filter((service) =>
        (selected.has(service.s) || selectedRoutes.has(routeKey(service))) &&
        (selectedStopFilter === null ||
          (service.p && service.p.some(([stop]) => stop === selectedStopFilter)) ||
          selectedRoutes.has(routeKey(service)))
      )
        .sort((a, b) =>
          Math.min(...(a.p ? a.p.map((point) => point[1]) : [0])) -
          Math.min(...(b.p ? b.p.map((point) => point[1]) : [0]))
        );
      visibleServices = visible.slice();
      visibleCourseEntries = [];
      const fragment = document.createDocumentFragment();
      
      visible.forEach((service) => {
        if (!service.p) return;
        const sorted = service.p.slice().sort((a, b) => a[1] - b[1]);
        if (!sorted.length) return;
        
        const seriesClass = " og-series-" + shiftOrder.indexOf(service.s);
        const courseColor = shiftColorMap[service.s] || "#3b82f6";
        const routeKeyVal = routeKey(service);
        
        // Separa i punti in passato e futuro per la trasparenza
        const pastPoints = [];
        const futurePoints = [];
        let lastPastPoint = null;
        const allPoints = sorted.map(([stop, minute]) => x(minute) + "," + y(stop)).join(" ");
        
        const path = node("polyline", {
          points: allPoints,
          class: "og-route" + seriesClass,
          "data-direction": service.d,
          "aria-label": routeText(service)
        });
        path.style.stroke = courseColor;
        path.dataset.routeKey = routeKeyVal;
        const hitPath = node("polyline", {
          points: allPoints,
          class: "og-route-hit",
          "data-route-key": routeKeyVal,
          "aria-label": "Seleziona " + routeText(service)
        });
        const handleRouteEnter = (event) => {
          path.classList.add("is-active");
          if (!selectedRoutes.size) highlightRouteStops(service, courseColor, true);
          showTooltip(
            '<span class="og-tooltip-label">' +
              escapeHtml(service.s + " · corsa " + service.r) +
            '</span>' +
            '<span class="og-tooltip-line">' +
              escapeHtml(prettyStopName(sorted[0][0]) + " " + formatTime(sorted[0][1])) +
            '</span>' +
            '<span class="og-tooltip-line">' +
              escapeHtml(prettyStopName(sorted[sorted.length - 1][0]) + " " +
                formatTime(sorted[sorted.length - 1][1])) +
            '</span>',
            event,
            courseColor
          );
        };
        const handleRouteLeave = () => {
          if (isMobileLayout() && previewRouteKey === routeKey(service)) return;
          path.classList.remove("is-active");
          if (!selectedRoutes.size) clearStopRouteHighlight();
          hideTooltip();
        };

        let routeTouchStart = null;
        const handleRouteTouchStart = (event) => {
          if (!isMobileLayout() || !event.touches || event.touches.length !== 1) {
            routeTouchStart = null;
            return;
          }
          const touch = event.touches[0];
          routeTouchStart = {
            id: touch.identifier,
            x: touch.clientX,
            y: touch.clientY
          };
          event.stopPropagation();
        };

        const handleRouteTouchEnd = (event) => {
          if (!isMobileLayout()) return;
          if (!routeTouchStart || !event.changedTouches || event.changedTouches.length !== 1) {
            routeTouchStart = null;
            return;
          }
          const touch = event.changedTouches[0];
          if (touch.identifier !== routeTouchStart.id) {
            routeTouchStart = null;
            return;
          }
          const deltaX = touch.clientX - routeTouchStart.x;
          const deltaY = touch.clientY - routeTouchStart.y;
          routeTouchStart = null;
          if (Math.hypot(deltaX, deltaY) > MOBILE_TAP_MOVE_THRESHOLD) return;

          const previewEvent = {clientX: touch.clientX, clientY: touch.clientY};
          const key = routeKey(service);
          if (consumeRouteDoubleTap(key)) {
            clearRoutePreview();
            toggleSelectedRoute(path, service, courseColor);
          } else {
            scheduleRouteSingleTap(key, () => {
              previewRoute(path, service, courseColor, previewEvent, sorted);
            });
          }
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
        };

        const handleRouteTouchCancel = () => {
          routeTouchStart = null;
        };

        const handleRouteClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isMobileLayout()) return;
          toggleSelectedRoute(path, service, courseColor);
        };
        hitPath.addEventListener("mouseenter", handleRouteEnter);
        hitPath.addEventListener("mousemove", handleRouteEnter);
        hitPath.addEventListener("mouseleave", handleRouteLeave);
        hitPath.addEventListener("touchstart", handleRouteTouchStart, {passive: true});
        hitPath.addEventListener("touchend", handleRouteTouchEnd, {passive: false});
        hitPath.addEventListener("touchcancel", handleRouteTouchCancel, {passive: true});
        hitPath.addEventListener("click", handleRouteClick);
        visibleCourseEntries.push({path: path, service: service});
        fragment.appendChild(path);
        fragment.appendChild(hitPath);
        
        const coursePause = pauseAfter(service);
        sorted.forEach(([stop, minute], pointIndex) => {
          const stopPause = pointIndex === sorted.length - 1 ? coursePause : null;
          const dot = node("circle", {
            cx: x(minute), cy: y(stop), r: 3,
            class: "og-stop-dot" + seriesClass,
            "data-direction": service.d
          });
          const dotHit = node("circle", {
            cx: x(minute), cy: y(stop), r: 11,
            class: "og-stop-hit",
            "data-direction": service.d
          });
          dot.style.stroke = courseColor;
          dot.dataset.routeKey = routeKey(service);
          dotHit.dataset.routeKey = routeKey(service);
          const handleDotEnter = (event) => {
            if (!selectedRoutes.size) highlightRouteStops(service, courseColor, false);
            const stopLabel = root.querySelector('.og-axis-label[data-stop="' + stop + '"]');
            if (stopLabel) stopLabel.classList.add("is-stop-active");
            showTooltip(
              '<span class="og-tooltip-label">' +
                escapeHtml(service.s + " · corsa " + service.r) +
              '</span>' +
              '<span class="og-tooltip-line">' +
                escapeHtml(prettyStopName(stop) + " " + (stopPause
                  ? formatTime(stopPause.arrival)
                  : formatTime(minute))) +
              '</span>',
              event,
              courseColor
            );
          };
          const handleDotLeave = () => {
            if (!selectedRoutes.size) clearStopRouteHighlight();
            root.querySelectorAll(".og-axis-label.is-stop-active").forEach((item) =>
              item.classList.remove("is-stop-active")
            );
            hideTooltip();
          };
          const handleDotClick = (event) => {
            event.stopPropagation();
            if (isMobileLayout()) return;
            toggleSelectedRoute(path, service, courseColor);
          };
          dotHit.addEventListener("mouseenter", handleDotEnter);
          dotHit.addEventListener("mousemove", positionTooltipNearPointer);
          dotHit.addEventListener("mouseleave", handleDotLeave);
          dotHit.addEventListener("touchstart", handleRouteTouchStart, {passive: true});
          dotHit.addEventListener("touchend", handleRouteTouchEnd, {passive: false});
          dotHit.addEventListener("touchcancel", handleRouteTouchCancel, {passive: true});
          dotHit.addEventListener("click", handleDotClick);
          fragment.appendChild(dot);
          fragment.appendChild(dotHit);
        });
        const first = sorted[0];
        const labelX = isMobileLayout() ? margin.left + 2 : x(first[1]) + 4;
        const label = node("text", {
          x: labelX, y: y(first[0]) - 5,
          class: "og-course-label",
          "data-route-key": routeKey(service)
        }, selected.size > 1 ? service.s + "/" + service.r : service.r);
        
        fragment.appendChild(label);
      });
      svg.appendChild(fragment);
      
      // Aggiungi ombra sul passato
      const currentMinute = getDisplayedTimeMinutes();
      if (currentMinute >= 450 && currentMinute <= 1250) {
        const pastOverlay = node("rect", {
          x: margin.left,
          y: margin.top,
          width: Math.max(0, x(currentMinute) - margin.left),
          height: height - margin.top - margin.bottom,
          fill: "#000000",
          opacity: "0.35",
          "pointer-events": "none"
        });
        svg.appendChild(pastOverlay);
      }
      
      visibleCourseEntries.sort((a, b) => {
        const numberA = Number.parseInt(a.service.r, 10);
        const numberB = Number.parseInt(b.service.r, 10);
        return numberA - numberB || String(a.service.r).localeCompare(String(b.service.r), "it", {numeric: true});
      });

      const shiftNames = Array.from(selected);
      const stopFilterText = selectedStopFilter === null
        ? ""
        : " · scalo: " + data.stops[selectedStopFilter];
      if (summary) {
        summary.textContent = shiftNames.length
          ? shiftNames.join(", ") + " · " + visible.length + " corse visualizzate" + stopFilterText
          : "Nessun turno selezionato";
      }
      if (detail) {
        detail.textContent = visible.length
          ? "Passa su una linea o selezionala per vedere tutti gli scali e gli orari."
          : "Nessuna corsa con i filtri selezionati.";
      }
      if (preserveSelections && selectedRoutes.size) renderSelectedRoutes();
      else if (shouldRenderShiftCoincidences()) renderCoincidences();
      activePath = null;
    }

    root.querySelectorAll(".og-shift-button").forEach((button) => {
      button.addEventListener("click", () => {
        button.setAttribute("aria-pressed",
          String(button.getAttribute("aria-pressed") !== "true"));
        draw();
      });
    });
    
    root.querySelectorAll(".og-shift-expand").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const list = root.querySelector('.og-race-list[data-shift="' +
          button.dataset.shift + '"]');
        if (!list) return;
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        list.hidden = !open;
      });
    });
    
    root.querySelectorAll(".og-race-button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const service = data.services.find((item) =>
          item.s === button.dataset.shift && item.r === button.dataset.race
        );
        if (!service) return;
        const hadSelection = selectedRoutes.size > 0;
        const shiftButton = root.querySelector('.og-shift-button[data-shift="' +
          service.s + '"]');
        if (shiftButton && shiftButton.getAttribute("aria-pressed") !== "true") {
          const savedLeft = chartWrap ? chartWrap.scrollLeft : 0;
          const savedTop = chartWrap ? chartWrap.scrollTop : 0;
          shiftButton.setAttribute("aria-pressed", "true");
          draw(true);
          if (chartWrap) {
            chartWrap.scrollLeft = savedLeft;
            chartWrap.scrollTop = savedTop;
          }
        }
        toggleSelectedRoute(null, service, shiftColorMap[service.s] || "#3b82f6",
          !hadSelection);
      });
    });
    
    root.querySelectorAll(".og-residence-name").forEach((button) => {
      button.addEventListener("click", () => {
        const residence = residenceOrder.find(([name]) => name === button.dataset.residence);
        if (!residence) return;
        const selected = selectedShifts();
        const anySelected = residence[1].some((shift) => selected.has(shift));
        residence[1].forEach((shift) => {
          if (anySelected) selected.delete(shift);
          else selected.add(shift);
        });
        selectOnly(selected);
      });
    });

    // --- RIPRISTINATI I PULSANTI MANGIATI PER ERRORE! ---
    const btnMenuMaster = root.querySelector(".og-menu-master");
    if (btnMenuMaster) {
      btnMenuMaster.addEventListener("click", () => {
        selectedStopFilter = null;
        selectOnly(selectedShifts().size ? [] : shiftOrder);
      });
    }

    if (allRacesButton) {
      allRacesButton.addEventListener("click", () => {
        selectedStopFilter = null;
        selectOnly(shiftOrder);
      });
    }

    if (noRacesButton) {
      noRacesButton.addEventListener("click", () => {
        selectedStopFilter = null;
        selectOnly([]);
      });
    }
    // ----------------------------------------------------

    if (normalMatrix && rapidMatrix) drawTravelMatrices();
    renderSelectedCoursePills();
    draw();

    // Stato iniziale coerente: su mobile menu chiuso, su desktop visibile salvo override.
    setTurniMenuOpen(isMobileLayout() ? false : !root.classList.contains("og-turns-hidden"));

    function syncResidencesHost() {
      if (isMobileLayout()) {
        if (residences && residences.parentElement !== root) {
          // Su mobile chartWrap puo' non essere figlio diretto di root durante alcuni reflow.
          if (chartWrap && chartWrap.parentElement === root) {
            root.insertBefore(residences, chartWrap);
          } else {
            root.appendChild(residences);
          }
        }
        syncResidencesDragPosition();
        return;
      }
      if (residences && chartWrap && residences.parentElement !== chartWrap) {
        chartWrap.insertBefore(residences, chartWrap.firstChild);
      }
      syncResidencesDragPosition();
      // Sincronizza il pulsante quando cambia il layout
      syncTurniMenuToggle();
    }

    if (coincidenceToggle) {
      coincidenceToggle.addEventListener("click", () => {
        const enabled = coincidenceToggle.getAttribute("aria-pressed") !== "true";
        coincidenceToggle.setAttribute("aria-pressed", String(enabled));
        coincidenceToggle.textContent = enabled ? "⇄ ON" : "⇄ OFF";
        if (selectedRoutes.size) renderSelectedRoutes();
        else renderCoincidences();
      });
    }

    // Controllo manuale dell'orario dell'ombra
    const shadowTimeSlider = root.querySelector("#og-shadow-time");
    const shadowTimeDisplay = root.querySelector("#og-shadow-time-display");

    function updateShadowDisplay() {
      if (!shadowTimeDisplay) return;
      const currentMinutes = getDisplayedTimeMinutes();
      if (displayedTimeMinutes === null) {
        // Modalità "reale" - mostra e aggiorna con l'ora attuale
        shadowTimeDisplay.textContent = formatTime(currentMinutes);
        if (shadowTimeSlider) shadowTimeSlider.value = currentMinutes;
      } else {
        // Modalità manuale - mostra l'ora selezionata
        shadowTimeDisplay.textContent = formatTime(displayedTimeMinutes);
        if (shadowTimeSlider) shadowTimeSlider.value = displayedTimeMinutes;
      }
    }

    if (shadowTimeSlider) {
      shadowTimeSlider.addEventListener("input", (event) => {
        displayedTimeMinutes = Number.parseInt(event.target.value, 10);
        updateShadowDisplay();
        draw(Boolean(selectedRoutes.size));
      });
    }

    // Click sull'orario per reset immediato all'ora attuale
    if (shadowTimeDisplay) {
      shadowTimeDisplay.addEventListener("click", () => {
        displayedTimeMinutes = null;
        updateShadowDisplay();
        draw(Boolean(selectedRoutes.size));
      });
    }

    // Inizializza il display dell'ombra con l'ora attuale
    updateShadowDisplay();

    // Aggiorna lo slider ogni minuto se in modalità reale
    setInterval(() => {
      if (displayedTimeMinutes === null) {
        updateShadowDisplay();
      }
    }, 60000);

    function lockStopAxisToLeft() {
      if (stopAxis && chartWrap) stopAxis.style.transform = "translateX(" + chartWrap.scrollLeft + "px)";
      if (timeAxis && chartWrap) timeAxis.style.transform = "translateY(" + chartWrap.scrollTop + "px)";
      syncResidencesDragPosition();
    }

    syncResidencesHost();
    if (chartWrap) {
      chartWrap.addEventListener("scroll", lockStopAxisToLeft, {passive: true});
    }

    function setChartZoom(nextZoom, clientX, clientY) {
      const previousZoom = chartZoom;
      chartZoom = Math.max(MIN_CHART_ZOOM, Math.min(MAX_CHART_ZOOM, nextZoom));
      if (chartZoom === previousZoom) return;
      if (!chartWrap) return;
      const rect = chartWrap.getBoundingClientRect();
      const pointerX = clientX == null ? rect.width / 2 : clientX - rect.left;
      const pointerY = clientY == null ? rect.height / 2 : clientY - rect.top;
      const contentX = chartWrap.scrollLeft + pointerX;
      const contentY = chartWrap.scrollTop + pointerY;
      const fixedAxisWidth = stopAxis ? stopAxis.offsetWidth : 0;
      const zoomRatio = chartZoom / previousZoom;
      if (zoomValue) zoomValue.textContent = Math.round(chartZoom * 100) + "%";
      draw(Boolean(selectedRoutes.size));
      requestAnimationFrame(() => {
        chartWrap.scrollLeft = Math.max(0, fixedAxisWidth +
          (contentX - fixedAxisWidth) * zoomRatio - pointerX);
        chartWrap.scrollTop = Math.max(0, 72 + (contentY - 72) * zoomRatio - pointerY);
      });
    }

    if (chartStage) {
      chartStage.addEventListener("wheel", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setChartZoom(
          chartZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
          event.clientX,
          event.clientY
        );
      }, {passive: false});
    }

    if (zoomOut) zoomOut.addEventListener("click", () => setChartZoom(chartZoom / 1.2));
    if (zoomIn) zoomIn.addEventListener("click", () => setChartZoom(chartZoom * 1.2));
    if (zoomValue) {
      zoomValue.addEventListener("click", () => {
        setChartZoom(1);
        if (chartWrap && chartWrap.scrollTo) {
          chartWrap.scrollTo({left: 0, top: 0, behavior: "smooth"});
        } else if (chartWrap) {
          chartWrap.scrollLeft = 0;
          chartWrap.scrollTop = 0;
        }
      });
    }

    let panState = null;
    let pinchState = null;
    const pinchPointers = new Map();
    let suppressCourseClick = false;
    if (chartStage) {
      chartStage.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") {
          pinchPointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
          if (pinchPointers.size >= 2) {
            const points = Array.from(pinchPointers.values());
            const dx = points[0].x - points[1].x;
            const dy = points[0].y - points[1].y;
            pinchState = {
              startDistance: Math.max(1, Math.hypot(dx, dy)),
              startZoom: chartZoom
            };
            panState = null;
            chartStage.classList.add("is-panning");
            return;
          }
        }
        if (event.button !== 0 || event.target.closest("button")) return;
        panState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: chartWrap ? chartWrap.scrollLeft : 0,
          scrollTop: chartWrap ? chartWrap.scrollTop : 0,
          dragged: false
        };
      });
      chartStage.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch" && pinchPointers.has(event.pointerId)) {
          pinchPointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
          if (pinchState && pinchPointers.size >= 2) {
            const points = Array.from(pinchPointers.values());
            const dx = points[0].x - points[1].x;
            const dy = points[0].y - points[1].y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const midpointX = (points[0].x + points[1].x) / 2;
            const midpointY = (points[0].y + points[1].y) / 2;
            setChartZoom(
              pinchState.startZoom * (distance / pinchState.startDistance),
              midpointX,
              midpointY
            );
            event.preventDefault();
            return;
          }
        }
        if (!panState || panState.pointerId !== event.pointerId || !chartWrap) return;
        const deltaX = event.clientX - panState.startX;
        const deltaY = event.clientY - panState.startY;
        if (!panState.dragged && Math.hypot(deltaX, deltaY) < 9) return;
        if (!panState.dragged) {
          panState.dragged = true;
          if (typeof chartStage.setPointerCapture === "function") {
              try { chartStage.setPointerCapture(event.pointerId); } catch(e) {}
          }
        }
        chartStage.classList.add("is-panning");
        chartWrap.scrollLeft = panState.scrollLeft - deltaX;
        chartWrap.scrollTop = panState.scrollTop - deltaY;
        event.preventDefault();
      });
    }

    function finishPan(event) {
      if (pinchPointers.has(event.pointerId)) {
        pinchPointers.delete(event.pointerId);
        if (pinchPointers.size < 2) pinchState = null;
      }
      if (!panState || panState.pointerId !== event.pointerId) {
        if (chartStage && !pinchState && pinchPointers.size === 0) {
          chartStage.classList.remove("is-panning");
        }
        return;
      }
      suppressCourseClick = panState.dragged;
      if (chartStage) {
        chartStage.classList.remove("is-panning");
        if (typeof chartStage.hasPointerCapture === "function" && chartStage.hasPointerCapture(event.pointerId)) {
          try { chartStage.releasePointerCapture(event.pointerId); } catch(e) {}
        }
      }
      panState = null;
      if (suppressCourseClick) {
        setTimeout(() => { suppressCourseClick = false; }, 120);
      }
    }

    if (chartStage) {
      chartStage.addEventListener("pointerup", finishPan);
      chartStage.addEventListener("pointercancel", finishPan);
      chartStage.addEventListener("click", (event) => {
        if (!suppressCourseClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressCourseClick = false;
      }, true);
      chartStage.addEventListener("click", (event) => {
        if (isMobileLayout() && !event.target.closest(".og-route-hit,.og-route,.og-stop-dot,.og-stop-hit")) {
          clearRoutePreview();
          clearPendingRouteTap();
        }
        if (!selectedRoutes.size) return;
        if (event.target.closest(".og-route-hit,.og-route,.og-stop-dot,.og-stop-hit")) return;
        clearSelectedRoutes();
        if (detail) detail.textContent = "Selezioni annullate: sono nuovamente visibili tutte le corse.";
      });
      chartStage.addEventListener("dblclick", (event) => {
        if (event.target.closest(".og-route-hit,.og-route,.og-stop-dot,.og-stop-hit")) return;
        clearSelectedRoutes();
        setChartZoom(1);
        if (chartWrap && chartWrap.scrollTo) {
          chartWrap.scrollTo({left: 0, top: 0, behavior: "smooth"});
        } else if (chartWrap) {
          chartWrap.scrollLeft = 0;
          chartWrap.scrollTop = 0;
        }
        if (detail) detail.textContent = "Selezioni annullate e zoom ripristinato.";
      });
    }

    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener("click", () => {
        const isCurrentlyOpen = mobileMenuToggle.getAttribute("aria-expanded") === "true";
        setTurniMenuOpen(!isCurrentlyOpen);
      });
    }

    if (mobileMenuBackdrop) {
      mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
    }

    let resizeTimer;
    const triggerResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        syncTurniMenuToggle();
        clampElementToViewport(selectedCoursePills);
        draw();
      }, 80);
    };
    
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(triggerResize).observe(root);
    } else {
      window.addEventListener("resize", triggerResize);
    }

  } catch (error) {
    logErrorToScreen(error.message, error.stack);
  }
})();
