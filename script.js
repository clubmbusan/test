function parseCurrency(value) {
    return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0; // 콤마 제거 후 숫자로 변환
}
// 숫자 입력 필드에 콤마 추가
document.addEventListener('input', function (event) {
    const target = event.target;
    if (['cashAmount', 'realEstateValue', 'stockPrice'].includes(target.id) || target.classList.contains('amount-input')) {
        const rawValue = target.value.replace(/[^0-9]/g, ''); // 숫자 외 문자 제거
        if (rawValue === '') {
            target.value = ''; // 빈 값 처리
            return;
        }
        target.value = parseInt(rawValue, 10).toLocaleString(); // 숫자에 콤마 추가
    }
});

// 관계별 공제 한도 계산
function getExemptionAmount(relationship) {
    const exemptions = {
        'adultChild': 50000000,       // 성년 자녀: 5천만 원
        'minorChild': 20000000,       // 미성년 자녀: 2천만 원
        'spouse': 600000000,          // 배우자: 6억 원
        'sonInLawDaughterInLaw': 50000000, // 사위/며느리: 5천만 원
        'other': 10000000             // 타인: 1천만 원
    };
    return exemptions[relationship] || 0;
}

// 재산 유형별 증여 금액 계산
function getGiftAmount() {
    const selectedType = document.getElementById('assetType').value;
    let giftAmount = 0;

    if (selectedType === 'cash') {
        giftAmount = parseCurrency(document.getElementById('cashAmount').value || '0');
    } else if (selectedType === 'realEstate') {
        giftAmount = parseCurrency(document.getElementById('realEstateValue').value || '0');
    } else if (selectedType === 'stock') {
        const stockQuantity = parseInt(document.getElementById('stockQuantity').value || '0', 10);
        const stockPrice = parseCurrency(document.getElementById('stockPrice').value || '0');
        giftAmount = stockQuantity * stockPrice; // 총 주식 금액
    }
    return giftAmount;
}

// 과거 증여 데이터 수집 함수
function getPreviousGifts() {
    const previousGiftInputs = document.querySelectorAll('.amount-input');
    const previousGiftDates = document.querySelectorAll('.date-input');
    let previousGifts = [];

    previousGiftInputs.forEach((input, index) => {
        const amount = parseCurrency(input.value || '0');
        const date = previousGiftDates[index]?.value || null;

        if (amount > 0 && date) {
            previousGifts.push({ amount, date });
        }
    });

    return previousGifts;
}

// 과세 금액 계산 및 공제 계산 함수
function calculateTaxableAmountAndExemption(relationship, giftAmount, previousGifts) {
    const exemption = getExemptionAmount(relationship);

    const totalPastGifts = previousGifts.reduce((sum, gift) => sum + gift.amount, 0);
    const adjustedExemption = Math.max(exemption - totalPastGifts, 0);
    const taxableAmount = Math.max(giftAmount - adjustedExemption, 0);

    return { adjustedExemption, taxableAmount };
}

// 누진세 계산
function calculateGiftTax(taxableAmount) {
    const taxBrackets = [
        { limit: 100000000, rate: 0.1, deduction: 0 },          // 1억 이하 10%
        { limit: 500000000, rate: 0.2, deduction: 10000000 },  // 1억 초과 ~ 5억 이하 20%, 공제: 1천만 원
        { limit: 1000000000, rate: 0.3, deduction: 60000000 }, // 5억 초과 ~ 10억 이하 30%, 공제: 6천만 원
        { limit: 3000000000, rate: 0.4, deduction: 160000000 },// 10억 초과 ~ 30억 이하 40%, 공제: 1억6천만 원
        { limit: Infinity, rate: 0.5, deduction: 460000000 }   // 30억 초과 50%, 공제: 4억6천만 원
    ];

    let tax = 0;
    let previousLimit = 0;

    for (const bracket of taxBrackets) {
        if (taxableAmount > bracket.limit) {
            tax += (bracket.limit - previousLimit) * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            tax += (taxableAmount - previousLimit) * bracket.rate;
            tax -= bracket.deduction; // 공제 적용
            break;
        }
    }

    return Math.max(tax, 0);
}

// 농어촌특별세 계산
function calculateSpecialTax(giftTax) {
    return Math.floor(giftTax * 0.1); // 농어촌특별세는 증여세의 10%
}

// 가산세 계산 로직
function calculateLatePenalty(submissionDate, giftDate, giftTax) {
    const giftDateObj = new Date(giftDate);
    const submissionDateObj = new Date(submissionDate);

    if (!giftDate || !submissionDate || isNaN(giftDateObj) || isNaN(submissionDateObj)) {
        return { penalty: 0, message: "날짜가 잘못 입력되었습니다." };
    }

    const dueDate = new Date(giftDateObj);
    dueDate.setMonth(dueDate.getMonth() + 3);

    if (submissionDateObj <= dueDate) {
        return { penalty: 0, message: "신고 기한 내 신고 완료" };
    }

    const extendedDueDate = new Date(giftDateObj);
    extendedDueDate.setMonth(extendedDueDate.getMonth() + 6);

    if (submissionDateObj <= extendedDueDate) {
        return { penalty: giftTax * 0.1, message: "신고 기한 초과 (3~6개월)" };
    }

    return { penalty: giftTax * 0.2, message: "신고 기한 초과 (6개월 초과)" };
}

// 최종 세금 계산 및 출력
function calculateFinalTax() {
    const giftAmount = getGiftAmount();
    const previousGifts = getPreviousGifts();
    const relationship = document.getElementById('relationship').value;

    const { adjustedExemption, taxableAmount } = calculateTaxableAmountAndExemption(relationship, giftAmount, previousGifts);
    const giftTax = calculateGiftTax(taxableAmount);
    const specialTax = calculateSpecialTax(giftTax);

    const giftDate = document.getElementById('giftDate').value;
    const submissionDate = document.getElementById('submissionDate').value;
    const { penalty, message } = calculateLatePenalty(submissionDate, giftDate, giftTax);

    const totalTax = giftTax + specialTax + penalty;

    document.getElementById('result').innerHTML = `
        <h3>계산 결과</h3>
        <p>증여 금액: ${giftAmount.toLocaleString()} 원</p>
        <p>공제 금액: ${adjustedExemption.toLocaleString()} 원</p>
        <p>과세 금액: ${taxableAmount.toLocaleString()} 원</p>
        <p>증여세: ${giftTax.toLocaleString()} 원</p>
        <p>농어촌특별세: ${specialTax.toLocaleString()} 원</p>
        <p>가산세: ${penalty.toLocaleString()} 원 (${message})</p>
        <p><strong>최종 납부세액: ${totalTax.toLocaleString()} 원</strong></p>
    `;
}

// 계산하기 버튼 이벤트
document.getElementById('calculateButton').addEventListener('click', calculateFinalTax);
