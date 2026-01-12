let PLACES_CACHE = null;

function deepFind(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const k of Object.keys(obj)) {
    const v = deepFind(obj[k], key);
    if (v !== undefined) return v;
  }
  return undefined;
}

async function getCongestionFor(place) {
  const data = await fetchSeoulCitydataPpltn(place);
  const lvl = deepFind(data, "AREA_CONGEST_LVL"); // 혼잡도 레벨/문구
  const msg = deepFind(data, "AREA_CONGEST_MSG"); // 혼잡 메시지
  return { place, lvl, msg, raw: data };
}

getCongestionFor("강남역").then(console.log);

document.getElementById("searchBtn").addEventListener("click", () => {
  const q = document.getElementById("q").value.trim();
  if (q) showByQuery(q);
});
document.getElementById("refreshBtn").addEventListener("click", async () => {
  await loadPlaces(true);
  renderPlaceButtons();
});

async function loadPlaces(force = false) {
  if (PLACES_CACHE && !force) return PLACES_CACHE;

  // 캐시 무력화
  const res = await fetch("./data/places.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();
  PLACES_CACHE = data;
  return data;
}

function normalize(s) {
  return (s ?? "").toString().replace(/\s+/g, "").toLowerCase();
}

// 사용자가 "강남" 치면 "강남역" 같은 식으로 어느 정도 보정(원하면 확장 가능)
function aliasQuery(q) {
  const n = normalize(q);
  const map = {
    "강남": "강남역",
    "홍대": "홍대입구역",
    "홍대입구": "홍대입구역",
    "건대": "건대입구역",
    "잠실": "잠실 관광특구"
  };
  return map[n] || q;
}

async function renderPlaceButtons() {
  const wrap = document.getElementById("places");
  wrap.innerHTML = "불러오는 중…";

  const data = await loadPlaces();
  const items = (data.items || []).filter(x => x && x.place);

  // 버튼 렌더
  wrap.innerHTML = "";
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "place-btn";
    btn.textContent = item.place;
    btn.addEventListener("click", () => showItem(item));
    wrap.appendChild(btn);
  });

  // 메타
  document.getElementById("meta").innerText =
    data.updated ? `업데이트: ${data.updated}` : "";
}

function mapCongestionToRate(level) {
  const raw = (level ?? "").toString().trim();
  const s = raw.replace(/\s+/g, "");

  // 숫자 레벨이 오면 대비
  const n = Number(s);
  if (!Number.isNaN(n)) {
    if (n <= 1) return 5;
    if (n === 2) return 30;
    if (n === 3) return 65;
    return 85;
  }

  // 문자열 대비(혼잡/붐빔/원활/한산 등)
  if (s.includes("매우") && (s.includes("혼잡") || s.includes("붐빔"))) return 85;
  if (s.includes("혼잡") || s.includes("붐빔")) return 65;
  if (s.includes("보통") || s.includes("약간")) return 30;
  if (s.includes("여유") || s.includes("원활") || s.includes("한산")) return 5;

  return 50;
}

function pickMessage(level) {
  const s = (level ?? "").toString();
  const rate = mapCongestionToRate(s);

  if (rate >= 85) return rand(["오늘은 집이 답", "인성 테스트 구간", "깔려죽을 확률 체감 MAX"]);
  if (rate >= 65) return rand(["팔꿈치 방패 장착 권장", "오늘은 이동이 아니라 밀림", "약속 잡은 친구 원망 가능"]);
  if (rate >= 30) return rand(["어깨 부딪힘은 각오", "데이트는 가능, 인내심 필요", "적당히 북적"]);
  return rand(["사람보다 바람이 더 많음", "오늘은 산책 가능", "숨 쉴 확률 매우 높음"]);
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function showItem(item) {
  const place = item.place;
  const congestion = item.congestion ?? "알수없음";
  const msg = item.msg ?? "";

  const rate = mapCongestionToRate(congestion);
  const line = pickMessage(congestion);

  document.getElementById("result").innerHTML = `
    <p class="big"><strong>${place}</strong> 오늘 가면 깔려죽을 확률 <strong>${rate}%</strong> (체감)</p>
    <div>${line}</div>
    <div class="muted" style="margin-top:10px;">
      혼잡도: ${congestion}${msg ? " / " + msg : ""}<br>
      ※ 본 수치는 공공데이터 혼잡도를 기반으로 한 체감 지수이며 실제 사고 확률과 무관합니다.
    </div>
  `;
}

async function showByQuery(q) {
  const data = await loadPlaces();
  const items = data.items || [];

  const fixed = aliasQuery(q);
  const target = items.find(x => normalize(x.place) === normalize(fixed));

  if (!target) {
    document.getElementById("result").innerHTML = `
      <p class="big"><strong>${q}</strong> 는 목록에 없어요.</p>
      <div class="muted">목록에 있는 장소명으로 클릭하거나, 정확히 입력해줘 (예: 강남역, 홍대입구역).</div>
    `;
    return;
  }
  showItem(target);
}

// 초기 로드
renderPlaceButtons();

document.getElementById("checkLiveBtn").addEventListener("click", async () => {
  try {
    const res = await fetch("./data/places.json?v=" + Date.now(), { cache: "no-store" });
    const data = await res.json();

    if (!data.updated) {
      alert("업데이트 시간을 확인할 수 없습니다.");
      return;
    }

    const updatedAt = new Date(data.updated);
    const now = new Date();

    const diffMs = now - updatedAt;
    const diffMin = Math.floor(diffMs / 1000 / 60);

    let message = "";

    if (diffMin <= 5) {
      message = `✅ 최신 데이터입니다.\n(${diffMin}분 전 업데이트)`;
    } else if (diffMin <= 15) {
      message = `⚠️ 약간 이전 데이터입니다.\n(${diffMin}분 전 업데이트)`;
    } else {
      message = `❗ 오래된 데이터입니다.\n(${diffMin}분 전 업데이트)\n잠시 후 다시 확인하세요.`;
    }

    alert(message);
  } catch (e) {
    alert("데이터를 확인할 수 없습니다.");
  }
});
