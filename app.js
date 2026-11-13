// 입력 화면과 결과 화면에서 사용하는 DOM 요소를 가져옵니다.
const input = document.querySelector('#terms-input');
const count = document.querySelector('#char-count');
const error = document.querySelector('#empty-error');
const result = document.querySelector('#result-section');
const button = document.querySelector('#analyze-button');
const editButton = document.querySelector('#edit-button');
const fileInput = document.querySelector('#terms-file');
const uploadStatus = document.querySelector('#upload-status');
const uploadedPages = document.querySelector('#uploaded-pages');
// 현재 분석할 텍스트의 출처와 업로드된 OCR 텍스트를 보관합니다.
let uploadedTermsText = '';
let analysisSource = 'paste';

// PDF.js가 PDF를 읽을 때 사용할 워커 파일을 지정합니다.
if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 약관에서 찾을 주요 카테고리와 각 카테고리의 검색어를 정의합니다.
const categories = [
  { key:'payment', icon:'💰', title:'결제·비용', terms:['결제','요금','가격','자동결제','자동 갱신','자동갱신','구독','무료 체험','무료 이용','청구','이용료'] },
  { key:'privacy', icon:'🔐', title:'개인정보', terms:['개인정보','개인 정보','개인정보 보호','수집 항목','보관 기간','보유 기간','개인정보 파기','개인정보 삭제','개인정보 이용 목적'] },
  { key:'thirdParty', icon:'👥', title:'제3자 확인', terms:['제3자','제휴사','제공받','외부 기관','광고 사업자','다른 회사','공유','승인된 독립적인'] },
  { key:'permission', icon:'📍', title:'권한', terms:['위치','사진','카메라','마이크','연락처','기기 권한'] },
  { key:'marketing', icon:'📢', title:'광고·마케팅', terms:['광고','마케팅','광고성','맞춤형'] },
  { key:'refund', icon:'↩️', title:'환불·해지', terms:['환불','취소','해지','탈퇴','환불 제한'] },
  { key:'period', icon:'⏰', title:'서비스 기간', terms:['기간','기한','일 이내','개월','갱신','사전 통지','사전통지','무기한','종료될 때까지'] },
  { key:'rights', icon:'👤', title:'권리·의무', terms:['권리','의무','약관 변경','약관변경','이용 제한','책임'] },
  { key:'conditions', icon:'📱', title:'이용 조건', terms:['계정','연령','이용 조건','이용조건','사용 조건','사용조건','콘텐츠'] },
  { key:'special', icon:'❓', title:'특이 조건', terms:['면책','몰수','소유권','양도','분쟁','준거법','책임 제한'] },
];

// 여러 카테고리가 같은 조항을 찾았을 때 사용할 우선순위입니다.
const priorityOrder = ['payment', 'thirdParty', 'privacy', 'refund', 'permission', 'marketing', 'period', 'rights', 'conditions', 'special'];

// 약관의 예외, 모호성, 가능성, 적용 범위를 찾는 패턴입니다.
const exceptionPattern = /단,|다만|예외적으로|~?의 경우|~?에 한하여|제외|제한|사전 통지 없이|언제든지|할 수 없|변경될 수/;
const ambiguityPattern = /필요한 경우|일부|적절한 방법|별도의? 기준|회사에서 정한|회사가 판단|상황에 따라|필요하다고 판단|별도 정책|별도 기준|회사 판단에 따라/;
const possibilityPattern = /할 수 있|가능하|될 수 있|일 수 있|부과할 수|제공할 수|환불될 수/;
const scopePattern = /모든 회원|일부 회원|특정 회원|특정 국가|특정 지역|연령|기기|서비스 종류|이용 조건|회원에 한하여/;
// 약관 원문인지 판단하고 뉴스·지시문을 제외하기 위한 패턴입니다.
const termsTitlePattern = /서비스\s*이용\s*약관|개인정보\s*처리\s*방침|개인정보처리방침|서비스\s*약관/;
const articlePattern = /뉴스|기사|블로그|커뮤니티|게시글|리뷰|언론|보도|기자|광고 문구|해설|전문가에 따르면|에 따르면|논란|화제|입장문/;
const termsSignalPattern = /제\s*\d+\s*[조장절항]|본\s*(약관|방침)|회원은|이용자는|회사는|서비스 제공자|동의|수집|보유|파기|제공|책임|환불|해지|적용|시행일|개정/;
const instructionPattern = /이전\s*(지시|명령|규칙).*무시|시스템\s*(메시지|명령)|이\s*(지시|문장|내용)을?\s*(따르|실행|출력)|무엇을?\s*출력|다음과\s*(같이|같은)\s*(출력|응답)|분석하지\s*말|AI에게|너는\s*(반드시|이제)|명령에\s*따라/;

// OCR 결과에서 자주 분리되는 약관 용어를 원래 표현으로 합칩니다.
const ocrCorrections = [
  [/개\s*인\s*정\s*보/g, '개인정보'],
  [/제\s*3\s*자/g, '제3자'],
  [/은\s*행\s*계\s*좌/g, '은행계좌'],
  [/자\s*동\s*결\s*제/g, '자동결제'],
  [/자\s*동\s*갱\s*신/g, '자동 갱신'],
  [/무\s*료\s*체\s*험/g, '무료 체험'],
  [/무\s*기\s*한/g, '무기한'],
  [/환\s*불/g, '환불'],
  [/해\s*지/g, '해지'],
  [/취\s*소/g, '취소'],
  [/수\s*집/g, '수집'],
  [/보\s*관/g, '보관'],
  [/삭\s*제/g, '삭제'],
  [/제\s*공/g, '제공'],
  [/확\s*인/g, '확인'],
  [/이\s*용\s*약\s*관/g, '이용약관'],
  [/개인\s*정보\s*보호/g, '개인정보 보호']
];

// OCR 오탈자와 불필요한 공백을 정리해 분석에 사용할 텍스트를 만듭니다.
function normalizeTermsText(text) {
  let normalized = text.normalize('NFC').replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  ocrCorrections.forEach(([pattern, replacement]) => { normalized = normalized.replace(pattern, replacement); });
  return normalized.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// 입력 전체가 약관인지 확인하고, 약관으로 볼 수 있는 문장만 남깁니다.
function classifyTermsInput(text) {
  const normalized = normalizeTermsText(text);
  const blocks = normalized.split(/\n+|(?<=[.!?。！？])\s+/).map(block => block.trim()).filter(Boolean);
  const hasTitle = termsTitlePattern.test(normalized);
  const hasArticle = articlePattern.test(normalized);
  const signalCount = (normalized.match(new RegExp(termsSignalPattern.source, 'g')) || []).length;
  const hasFormalStructure = /제\s*\d+\s*조/.test(normalized) && signalCount >= 2;
  if (!hasTitle && !hasFormalStructure) return { text:'', excluded:true, valid:false };

  const accepted = blocks.filter(block => !articlePattern.test(block) && !instructionPattern.test(block) && (termsTitlePattern.test(block) || termsSignalPattern.test(block) || /제\s*\d+\s*[조장절항]/.test(block)));
  const filteredText = accepted.join('\n');
  const excluded = hasArticle || accepted.length < blocks.length;
  if (!filteredText || !termsSignalPattern.test(filteredText)) return { text:'', excluded:true, valid:false };
  return { text:filteredText, excluded, valid:true };
}

// 입력 텍스트를 분석 가능한 문장 단위로 나눕니다.
function sentences(text) { return text.replace(/다\.(?=[0-9가-힣])/g, '다.\n').replace(/\s+/g, ' ').split(/(?<=[.!?。！？])\s+|\n+/).map(item => item.trim()).filter(item => item.length > 5); }

// 원문에서 조항 번호를 추출하며, 없으면 빈 문자열을 반환합니다.
function clauseNumber(text) {
  return (text && text.match(/(?:제\s*\d+\s*[조장절항]|\d+(?:\.\d+)+\.?)/) || [])[0] || '';
}
// 키워드뿐 아니라 문장 형식과 앞뒤 맥락을 점수화합니다.
function clauseContextScore(sentence, category, all, index) {
  const previous = all[index - 1] || '';
  const next = all[index + 1] || '';
  let score = 0;
  if (/제\s*\d+\s*[조장절항]/.test(sentence)) score += 4;
  if (/본\s*(약관|방침)|회원은|이용자는|회사는|서비스 제공자|귀하/.test(sentence)) score += 3;
  if (/(합니다|됩니다|할 수 있습니다|하여야 합니다|해야 합니다|않습니다|있습니다)\s*[.!?。！？]?$/.test(sentence)) score += 2;
  if (category.terms.some(term => previous.includes(term) || next.includes(term))) score += 1;
  if (termsTitlePattern.test(sentence) || /약관|방침|조항|정책/.test(previous) || /약관|방침|조항|정책/.test(next)) score += 2;
  if (articlePattern.test(sentence)) score -= 6;
  if (instructionPattern.test(sentence)) score -= 10;
  return score;
}
// 카테고리에 가장 잘 맞는 문장과 필요한 주변 문맥을 찾습니다.
function findSentence(category, all) {
  const matches = all.map((sentence, index) => {
    const termScore = category.terms.filter(term => sentence.includes(term)).length;
    const contextScore = clauseContextScore(sentence, category, all, index);
    return { sentence, index, termScore, contextScore, score: termScore * 2 + contextScore };
  }).filter(item => item.termScore && item.contextScore >= 2 && !(category.key === 'privacy' && isThirdPartySharing(item.sentence) && !/(수집|보관|보유|파기|삭제)/.test(item.sentence)));
  if (!matches.length) return undefined;
  const priority = matches.find(item => category.key === 'payment' && /(자동결제|자동 갱신|청구|결제)/.test(item.sentence)) || matches.sort((a, b) => b.score - a.score || b.termScore - a.termScore)[0];
  const previous = all[priority.index - 1];
  const next = all[priority.index + 1];
  const context = [];
  if (previous && (exceptionPattern.test(previous) || ambiguityPattern.test(previous) || scopePattern.test(previous) || (category.key === 'payment' && /(무료|체험)/.test(previous)))) context.push(previous);
  context.push(priority.sentence);
  if (next && (exceptionPattern.test(next) || ambiguityPattern.test(next) || scopePattern.test(next) || category.terms.some(term => next.includes(term)))) context.push(next);
  return [...new Set(context)].join(' ');
}
// 원문 조건의 영향과 모호성을 기준으로 신호등 상태를 결정합니다.
function getStatus(category, sentence) {
  if (!sentence) return 'none';
  if (category.key === 'payment' && /(자동|청구|결제|갱신)/.test(sentence)) return possibilityPattern.test(sentence) ? 'yellow' : 'red';
  if (category.key === 'thirdParty' && isThirdPartySharing(sentence)) return 'red';
  if (category.key === 'thirdParty' && /(확인|신원|은행계좌)/.test(sentence)) return 'yellow';
  if (ambiguityPattern.test(sentence) || exceptionPattern.test(sentence) || possibilityPattern.test(sentence) || scopePattern.test(sentence) || /동의하지 않|책임을 지지/.test(sentence)) return 'yellow';
  return 'green';
}

// 개인정보가 제3자에게 제공되는 문장인지 확인합니다.
function isThirdPartySharing(text) {
  return /(?:개인정보|개인 정보|회원 정보|정보|데이터).{0,30}(?:제3자|제휴사|외부 기관|광고 사업자|다른 회사).{0,30}(?:제공|공유)|(?:제3자|제휴사|외부 기관|광고 사업자|다른 회사)(?:에게|에)\s*(?:개인정보|개인 정보|정보|데이터)?\s*(?:제공|공유)/.test(text);
}

// 제3자 제공 문장은 일반 제3자 확인보다 구체적인 제목을 사용합니다.
function categoryTitle(item) {
  return item.key === 'thirdParty' && isThirdPartySharing(item.sentence) ? '제3자 제공' : item.title;
}
// 긴 문장을 카드에 맞는 길이로 줄이고 HTML 특수문자를 안전하게 변환합니다.
function shorten(text, length = 92) { return text.length > length ? `${text.slice(0, length)}…` : text; }
// 사용자 입력을 HTML에 삽입할 때 태그로 해석되지 않도록 이스케이프합니다.
function escapeHTML(text) { return text.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character])); }

// 한눈지도와 상세 카드에 사용할 핵심 주제를 만듭니다.
function mapWhat(category) {
  const text = category.sentence;
  const labels = {
    payment: /무료/.test(text) ? '무료 이용' : /자동|결제|청구|갱신/.test(text) ? '자동결제 조건' : '결제·비용',
    privacy: /위치정보|위치/.test(text) ? '위치정보 수집' : '개인정보 수집',
    thirdParty: isThirdPartySharing(text) ? '제3자 정보 제공' : /신원|은행계좌|확인/.test(text) ? '제3자 확인' : '제3자 관련 조건',
    permission: `${(text.match(/위치|사진|카메라|마이크|연락처/) || ['기기'])[0]} 권한`,
    marketing: /맞춤형/.test(text) ? '맞춤형 광고' : '마케팅 정보',
    refund: '환불·해지 조건',
    period: /무기한|종료될 때까지|무료/.test(text) ? '서비스 기간' : '이용 기간·기한',
    rights: '이용 권리·의무',
    conditions: '서비스 이용 조건',
    special: '특이 조건'
  };
  return labels[category.key] || category.title;
}

// 조항이 적용되는 대상이나 목적을 짧게 정리합니다.
function mapTarget(category) {
  const text = category.sentence;
  if (category.key === 'payment') return (text.match(/(?:월|일|연간)?\s?[\d,]+원/) || ['서비스 이용 과정'])[0].trim();
  if (category.key === 'thirdParty' && /신원|은행계좌|확인/.test(text)) return '신원·지정 계좌';
  if (category.key === 'thirdParty') return destination(category);
  if (category.key === 'privacy' && text.includes('서비스 제공')) return '서비스 제공 목적';
  if (category.key === 'marketing') return text.includes('이메일') ? '이메일·문자' : '광고·마케팅 채널';
  return destination(category);
}

// 조항이 사용자에게 미칠 수 있는 영향을 원문의 가능성 표현에 맞춰 정리합니다.
function mapImpact(category) {
  const text = category.sentence;
  const impacts = {
    payment: /자동|갱신|청구/.test(text) ? (possibilityPattern.test(text) ? '자동결제될 수 있음' : '자동결제됨') : '비용 확인 필요',
    privacy: /제3자|제휴사|외부|공유/.test(text) ? (possibilityPattern.test(text) ? '정보가 제공될 수 있음' : '정보가 제공됨') : '개인정보가 수집·이용됨',
    thirdParty: isThirdPartySharing(text) ? '정보가 제3자에게 제공될 수 있음' : /신원|은행계좌|확인/.test(text) ? '신원·계좌가 확인될 수 있음' : '제3자 관련 조건 확인',
    permission: /사용|이용/.test(text) ? '기능에 사용됨' : '권한 요청 가능',
    marketing: /동의하지 않|거부|선택/.test(text) ? '선택 여부 확인' : '광고·마케팅에 이용됨',
    refund: /제한|불가|없/.test(text) ? (possibilityPattern.test(text) ? '환불이 제한될 수 있음' : '환불이 제한됨') : '환불 조건 확인 필요',
    period: /무기한|종료될 때까지/.test(text) ? '종료될 때까지 무료 제공' : '기한에 따라 조건이 적용됨',
    rights: /제한|변경/.test(text) ? '이용 조건이 바뀌거나 제한될 수 있음' : '권리·의무 확인 필요',
    conditions: '서비스 이용에 영향을 줌',
    special: '개인 권리에 영향을 줄 수 있음'
  };
  return impacts[category.key] || '영향 확인 필요';
}

// 원문을 카테고리별로 분석하고 중복 조항을 통합합니다.
function analyze(text) {
  const sourceSentences = sentences(text);
  const all = sentences(normalizeTermsText(text));
  const found = categories.map(category => {
    const sentence = findSentence(category, all);
    const source = sourceSentences.find(item => category.terms.some(term => normalizeTermsText(item).includes(term)));
    const termScore = sentence ? category.terms.filter(term => sentence.includes(term)).length : 0;
    return { ...category, sentence, source: source || '', clauseNumber: clauseNumber(source), termScore };
  });
  const active = found.filter(item => item.sentence);
  const ordered = [...active].sort((a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key));
  return { found, active: deduplicateClauses(ordered) };
}

// 요약 영역에 표시할 한 줄짜리 판단 결과를 만듭니다.
function warningLine(item) {
  const status = getStatus(item, item.sentence);
  const prefix = status === 'red' ? '🔴 주의' : status === 'yellow' ? '🟡 확인' : '🟢 명확';
  return `${prefix} ${shorten(item.sentence, 105)}`;
}

// 요약 항목이 부족할 때 표시할 기본 안내 문구를 반환합니다.
function missingLine() { return '🟢 별도 주의 조건이 원문에서 확인되지 않아요.'; }

// 두 조항의 텍스트가 실질적으로 같은지 유사도를 계산합니다.
function clauseSimilarity(first, second) {
  const normalize = value => value.replace(/[\s.,!?;:()[\]{}"'“”‘’·-]/g, '');
  const left = normalize(first);
  const right = normalize(second);
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  const leftBigrams = new Set([...left].slice(0, -1).map((character, index) => left.slice(index, index + 2)));
  const rightBigrams = new Set([...right].slice(0, -1).map((character, index) => right.slice(index, index + 2)));
  const overlap = [...leftBigrams].filter(bigram => rightBigrams.has(bigram)).length;
  return overlap / new Set([...leftBigrams, ...rightBigrams]).size;
}

// 중복 조항 중 핵심 검색어가 더 많이 일치하는 대표 카테고리를 선택합니다.
function representativeCategory(first, second) {
  if (first.termScore !== second.termScore) return first.termScore > second.termScore ? first : second;
  return priorityOrder.indexOf(first.key) <= priorityOrder.indexOf(second.key) ? first : second;
}

// 유사도 80% 이상인 조항을 하나의 대표 항목으로 합칩니다.
function deduplicateClauses(items) {
  return items.reduce((unique, item) => {
    const duplicateIndex = unique.findIndex(existing => clauseSimilarity(existing.sentence, item.sentence) >= 0.8);
    if (duplicateIndex === -1) return [...unique, item];
    const representative = representativeCategory(unique[duplicateIndex], item);
    unique[duplicateIndex] = { ...representative, relatedKeys: [...new Set([...(unique[duplicateIndex].relatedKeys || []), ...(item.relatedKeys || []), item.key])] };
    return unique;
  }, []);
}

// 약관 한눈지도에 표시할 카테고리 카드를 HTML로 만듭니다.
function insightCard(item) {
  const status = getStatus(item, item.sentence);
  const statusLabel = status === 'red' ? '🔴 주의' : status === 'yellow' ? '🟡 확인' : '🟢 명확';
  return `<article class="insight-card"><span class="branch-arrow" aria-hidden="true">↓</span><div class="flow-title"><span class="insight-icon">${item.icon}</span><h4>${categoryTitle(item)}</h4><span class="status ${status}">${statusLabel}</span></div><div class="flow-steps"><div><b>무엇</b><p>${mapWhat(item)}</p></div><span class="flow-arrow">↓</span><div><b>대상·목적</b><p>${mapTarget(item)}</p></div><span class="flow-arrow">↓</span><div><b>나에게 생기는 영향</b><p>${mapImpact(item)}</p></div></div></article>`;
}

// 원문에서 찾지 못한 카테고리를 표시할 HTML을 만듭니다.
function unavailableCard(item) {
  return `<div class="unavailable-card"><span>${item.icon}</span><strong>${item.title}</strong><small>원문에서 명시되지 않음</small></div>`;
}

// 분석 결과를 요약, 한눈지도, 상세 카드, 확인 목록에 렌더링합니다.
function render(data) {
  const summaryItems = data.active.slice(0, 3);
  const summaryLines = summaryItems.map(warningLine);
  while (summaryLines.length < 3) summaryLines.push(missingLine());
  document.querySelector('#summary-lines').innerHTML = summaryLines.slice(0, 3).map(line => `<p>${line}</p>`).join('');
  const activeCards = data.active.map(insightCard).join('');
  const unavailable = data.found.filter(item => !item.sentence).map(unavailableCard).join('');
  document.querySelector('#insight-grid').innerHTML = `<div class="mindmap-core"><span>👤 나</span><b>동의</b><span>🏢 서비스</span><small>동의하면 달라지는 내용을 원문에서 찾았어요</small></div><div class="mindmap-branches">${activeCards || '<p class="mindmap-empty">원문에서 확인할 수 있는 주요 조건이 없어요.</p>'}</div><div class="unavailable-group"><span class="unavailable-title">원문에서 확인되지 않은 항목</span><div class="unavailable-list">${unavailable || '<span>모든 주요 항목이 원문에서 확인되었어요.</span>'}</div></div>`;
  const details = data.active.filter(item => getStatus(item, item.sentence) !== 'green' || ['payment','thirdParty'].includes(item.key)).slice(0, 3);
  document.querySelector('#details-block').innerHTML = details.length ? `<h3>🔎 자세히 확인할 내용</h3>${details.map((item, index) => { const hasSource = Boolean(item.source); const status = hasSource ? getStatus(item, item.sentence) : 'unknown'; const statusLabel = status === 'red' ? '🔴 주의' : status === 'yellow' ? '🟡 확인' : status === 'green' ? '🟢 명확' : '⚪ 확인되지 않음'; const source = hasSource ? escapeHTML(shorten(item.source, 180)) : '확인되지 않음'; const number = item.clauseNumber ? escapeHTML(item.clauseNumber) : '확인되지 않음'; const topic = hasSource ? escapeHTML(mapWhat(item)) : '확인되지 않음'; const explanation = explainClauseDetail(item); return `<article class="detail-card ${status}" tabindex="0" data-detail-index="${index}"><h4>${statusLabel}</h4><p><b>원문 조항 번호</b><br>→ ${number}</p><p class="detail-topic"><b>무슨 내용인가?</b><br>→ ${topic}</p><p class="quote"><b>📌 원문 근거</b><br>→ “${source}”</p><button class="detail-toggle" type="button">자세히 보기</button><div class="detail-explainer hidden"><div class="detail-explainer-box"><p><b>한 줄 해석</b><br>${escapeHTML(explanation.explanation)}</p><p><b>원문</b><br>“${escapeHTML(explanation.original)}”</p></div></div></article>`; }).join('')}` : '<h3>🔎 자세히 확인할 내용</h3><article class="detail-card green"><h4>🟢 명확</h4><p>입력한 원문에서 특별히 추가 확인이 필요한 조건이 많지 않아요.</p></article>';
  const checks = data.active.slice(0, 3).map(item => checkText(item));
  document.querySelector('#check-list').innerHTML = checks.length ? checks.map(text => `<li>${text}</li>`).join('') : '<li>입력한 원문에서 확인할 조건이 있는지 직접 살펴보세요.</li>';

  document.querySelector('#details-block').addEventListener('click', (event) => {
    const toggleButton = event.target.closest('.detail-toggle');
    const detailCard = event.target.closest('.detail-card');
    if (!detailCard) return;
    const explainer = detailCard.querySelector('.detail-explainer');
    if (!explainer) return;
    if (toggleButton || event.target === detailCard || event.target.closest('h4') || event.target.closest('p')) {
      const isOpen = detailCard.classList.toggle('expanded');
      explainer.classList.toggle('hidden', !isOpen);
    }
  });
  document.querySelector('#details-block').addEventListener('keydown', (event) => {
    if ((event.key !== 'Enter' && event.key !== ' ') && event.key !== 'Spacebar') return;
    const detailCard = event.target.closest('.detail-card');
    if (!detailCard) return;
    event.preventDefault();
    const explainer = detailCard.querySelector('.detail-explainer');
    if (!explainer) return;
    const isOpen = detailCard.classList.toggle('expanded');
    explainer.classList.toggle('hidden', !isOpen);
  });
}

// 업로드된 파일별 OCR 결과를 접을 수 있는 목록으로 표시합니다.
function renderUploadedPages(pages) {
  uploadedPages.innerHTML = `<div class="uploaded-pages-heading"><strong>📄 페이지별 원문</strong><span>${pages.length}장</span></div>${pages.map((page, index) => `<details class="uploaded-page" open><summary><span>페이지 ${index + 1}</span><b>${page.name}</b><small>${page.text.length.toLocaleString()}자</small></summary><p>${page.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></details>`).join('')}`;
  uploadedPages.classList.remove('hidden');
}

// 카테고리별 대상이나 목적을 계산합니다.
function destination(category) {
  const text = category.sentence;
  if (category.key === 'thirdParty' && /(제휴사|외부 기관|다른 회사|제3자)/.test(text)) return (text.match(/제휴사|외부 기관|다른 회사|제3자/) || ['제3자'])[0];
  if (category.key === 'privacy') return text.includes('서비스 제공') ? '서비스 제공 목적' : '서비스 또는 별도 정책';
  if (category.key === 'marketing') return text.includes('이메일') ? '이메일·문자 등 연락 수단' : '마케팅 채널';
  return '서비스 이용 과정';
}

// 동의 전에 확인할 항목의 짧은 문구를 만듭니다.
function checkText(item) {
  const checks = { payment:'결제 금액과 자동결제·갱신 시점', thirdParty: isThirdPartySharing(item.sentence) ? '개인정보의 제3자 제공 대상' : '신원·지정 계좌를 확인하는 주체', privacy:'개인정보 수집 항목과 이용 목적', refund:'환불·해지 조건과 제한', permission:'요청되는 기기 권한과 사용 목적', marketing:'마케팅 동의 선택 여부와 수신 거부 방법', period:'서비스 제공 기간과 종료 조건', rights:'약관 변경과 이용 제한 조건', conditions:'연령·계정 등 서비스 이용 조건', special:'책임 제한이나 분쟁 관련 조건' };
  return checks[item.key] || item.title;
}

// 조항을 한 줄로 풀어 설명해 사용자가 원문 의미를 더 쉽게 이해하도록 돕습니다.
function explainClauseDetail(item) {
  const sentence = (item.sentence || '').trim();
  const explanations = {
    payment: '회사와 회원이 비용을 정하고, 자동 결제/갱신으로 청구할 수 있어요.',
    privacy: '회사는 회원의 정보를 어떤 목적으로 보관하고, 누구에게 공유할 수 있어요.',
    thirdParty: '회사는 회원 정보를 제3자에게 제공할 수 있고, 그 이유는 서비스 운영 때문이에요.',
    permission: '회사는 위치·사진·연락처 같은 권한을 요청하고, 이를 서비스 제공에 사용해요.',
    marketing: '회사는 회원에게 광고나 마케팅 메시지를 보낼 수 있어요.',
    refund: '회원은 환불이나 해지 조건이 제한될 수 있고, 회사가 기준을 정해요.',
    period: '회사는 서비스 기간과 종료 시점을 정하고, 자동 연장이나 해지 기준을 적용해요.',
    rights: '회사와 회원의 권리, 의무, 제한 조건을 정해요.',
    conditions: '회사는 이용 조건과 제한을 정하고, 회원은 그 조건을 따라야 해요.',
    special: '회사는 예외, 면책, 책임 제한 같은 특수 조건을 정해요.'
  };
  const fallback = '회사는 이 조항으로 회원의 권리와 제한을 정해요.';
  const explanation = explanations[item.key] || fallback;
  return {
    explanation: explanation,
    original: sentence || '원문을 확인할 수 없습니다.'
  };
}

// 직접 입력하면 분석 출처를 붙여넣기로 바꾸고 글자 수를 갱신합니다.
input.addEventListener('input', () => { analysisSource = 'paste'; count.textContent = `${input.value.length.toLocaleString()}자`; error.textContent = ''; });
// 분석 버튼을 누르면 입력을 검증한 뒤 약관 원문만 분석합니다.
button.addEventListener('click', () => {
  const text = analysisSource === 'upload' ? uploadedTermsText.trim() : input.value.trim();
  if (!text) { error.textContent = '분석할 약관을 먼저 붙여넣어 주세요.'; input.focus(); return; }
  const classified = classifyTermsInput(text);
  if (!classified.valid) {
    result.classList.add('hidden');
    error.textContent = '⚠️ 약관 원문을 입력해주세요. 뉴스 기사나 일반 설명문은 분석 대상이 아닙니다.';
    input.focus();
    return;
  }
  if (classified.excluded) error.textContent = '약관 원문으로 확인되지 않는 내용이 포함되어 있어 해당 부분은 분석에서 제외했습니다.';
  else error.textContent = '';
  render(analyze(classified.text)); result.classList.remove('hidden'); result.scrollIntoView({ behavior:'smooth', block:'start' });
});
// 다시 입력하기를 누르면 결과를 숨기고 입력 영역으로 이동합니다.
editButton.addEventListener('click', () => { result.classList.add('hidden'); document.querySelector('.input-section').scrollIntoView({ behavior:'smooth' }); input.focus(); });

// PDF 텍스트를 먼저 추출하고, 텍스트가 부족하면 OCR로 페이지를 읽습니다.
async function extractPdf(file) {
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  const text = pages.join('\n');
  if (text.trim().length > 40) return text;
  uploadStatus.textContent = '스캔된 PDF라 사진처럼 글자를 읽는 중이에요...';
  const scannedPages = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 8); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const result = await window.Tesseract.recognize(canvas, 'kor+eng');
    scannedPages.push(result.data.text);
  }
  return scannedPages.join('\n');
}

// 이미지 파일에서 Tesseract OCR로 약관 텍스트를 추출합니다.
async function extractImage(file) {
  const result = await window.Tesseract.recognize(file, 'kor+eng');
  return result.data.text;
}

// 여러 이미지·PDF를 순서대로 읽어 하나의 분석 문서로 합칩니다.
fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files];
  if (!files.length) return;
  error.textContent = '';
  uploadStatus.textContent = `${files.length}개 파일에서 원문을 읽는 중이에요...`;
  fileInput.disabled = true;
  try {
    const extractedPages = [];
    for (const [index, file] of files.entries()) {
      uploadStatus.textContent = `${index + 1}/${files.length}번째 파일을 읽는 중이에요...`;
      const text = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        ? await extractPdf(file)
        : await extractImage(file);
      if (text.trim()) extractedPages.push({ name: file.name, text: text.trim() });
    }
    const text = extractedPages.map(page => page.text).join('\n\n');
    if (!text.trim()) throw new Error('empty');
    uploadedTermsText = text.trim();
    analysisSource = 'upload';
    renderUploadedPages(extractedPages);
    uploadStatus.textContent = `✓ ${files.length}개 파일의 원문을 합쳤어요.`;
  } catch (uploadError) {
    uploadStatus.textContent = '파일에서 글자를 읽지 못했어요. 선명한 사진이나 텍스트 PDF를 사용해 주세요.';
    error.textContent = '파일을 읽지 못했어요. 약관 원문을 직접 붙여넣어 주세요.';
  } finally {
    fileInput.disabled = false;
  }
});