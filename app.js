async function load() {
  const resultEl = document.getElementById("result");

  try {
    // 1. 최신 데이터 로드
    const res = await fetch("./data/latest.json", { cache: "no-store" });
    const data = await res.json();

    const congestion = data.congestion; // 여유 / 보통 / 혼잡 / 매우혼잡
    const updated = data.updated;

    // 2. 혼잡도 → 체감 확률 매핑
    const rate = mapCongestionToRate(congestion);

    // 3. 혼잡도별 멘트
    const message = pickMessage(congestion);

    // 4. 화면 출력
    resultEl.innerHTML = `
      <strong>오늘 가면 깔려죽을 확률 ${rate}%</strong> (체감)<br>
      ${message}<br><br>
      <small>
        혼잡도: ${congestion} / 업데이트: ${updated}<br>
        ※ 본 수치는 공공데이터 혼잡도를 기반으로 한 체감 지수이며
        실제 사고 확률과는 무관합니다.
      </small>
    `;
  } catch (e) {
    resultEl.innerText = "데이터를 불러오지 못했습니다.";
  }
}

// 혼잡도 → 퍼센트 (기준표)
function mapCongestionToRate(level) {
  switch (level) {
    case "여유":
      return 5;
    case "보통":
      return 30;
    case "혼잡":
      return 65;
    case "매우혼잡":
      return 85;
    default:
      return 50;
  }
}

// 혼잡도별 멘트
function pickMessage(level) {
  const messages = {
    여유: [
      "사람보다 바람이 더 많음",
      "오늘은 산책 가능",
      "숨 쉴 확률 매우 높음"
    ],
    보통: [
      "어깨 부딪힘은 각오",
      "데이트는 가능, 인내심 필요",
      "적당히 북적"
    ],
    혼잡: [
      "팔꿈치 방패 장착 권장",
      "오늘은 이동이 아니라 밀림",
      "약속 잡은 친구 원망 가능"
    ],
    매우혼잡: [
      "오늘은 집이 답",
      "여기서 약속 잡은 사람 인성 의심",
      "깔려죽을 확률 체감 MAX"
    ]
  };

  const pool = messages[level] || ["사람 많음"];
  return pool[Math.floor(Math.random() * pool.length)];
}
