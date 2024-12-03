// 증여세 누진세 계산 로직
const taxBrackets = [
    { limit: 10000000, rate: 10, deduction: 0 },          // 1천만 원 이하 10%
    { limit: 100000000, rate: 20, deduction: 10000000 },  // 1억 원 이하 20%
    { limit: 500000000, rate: 30, deduction: 60000000 },  // 5억 원 이하 30%
    { limit: 1000000000, rate: 40, deduction: 160000000 },// 10억 원 이하 40%
    { limit: 3000000000, rate: 50, deduction: 460000000 },// 30억 원 이하 50%
    { limit: Infinity, rate: 60, deduction: 960000000 }   // 30억 원 초과 60%
];

// 금액 입력 시 콤마 처리
document.addEventListener('input', function (e) {
    if (['cashAmount', 'realEstateValue', 'stockPrice', 'amount'].includes(e.target.id)) {
        e.target.value = e.target.value
            .replace(/[^0-9]/g, '') // 숫자 외 문자 제거
            .replace(/\B(?=(\d{3})+(?!\d))/g, ","); // 3자리마다 콤마 추가
    }
});

// 관계별 공제 한도 계산
function getExemptionAmount(relationship) {
    const exemptions = {
        'adultChild': 50000000,       // 성년 자녀 공제: 5천만 원
        'minorChild': 20000000,       // 미성년 자녀 공제: 2천만 원
        'spouse': 600000000,          // 배우자 공제: 6억 원
        'sonInLawDaughterInLaw': 50000000, // 사위/며느리 공제: 5천만 원
        'other': 1000000              // 타인 공제: 1천만 원
    };
    return exemptions[relationship] || 0;
}

// 증여세 계산 로직
function calculateGiftTax(taxableAmount) {
    let tax = 0;
    let previousLimit = 0;

    for (let i = 0; i < taxBrackets.length; i++) {
        const bracket = taxBrackets[i];

        if (taxableAmount > bracket.limit) {
            tax += (bracket.limit - previousLimit) * (bracket.rate / 100);
            previousLimit = bracket.limit;
        } else {
            tax += (taxableAmount - previousLimit) * (bracket.rate / 100);
            tax -= bracket.deduction;
            break;
        }
    }
    return Math.max(tax, 0);
}

// 가산세 계산 로직
function calculateLatePenalty(submissionDate, giftDate, giftTax) {
    const giftDateObj = new Date(giftDate);
    const submissionDateObj = new Date(submissionDate);

    if (!giftDate || !submissionDate || isNaN(giftDateObj) || isNaN(submissionDateObj)) {
        return { penalty: 0, message: "날짜가 잘못 입력되었습니다." };
    }

    const dueDate = new Date(giftDateObj);
    dueDate.setMonth(dueDate.getMonth() + 3); // 신고 기한: 증여일 + 3개월

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

// 과거 증여 금액 추가 버튼
document.getElementById('addGiftButton').addEventListener('click', function () {
    const container = document.getElementById('previousGifts');
    const newGiftEntry = document.createElement('div');
    newGiftEntry.style.marginBottom = '10px';
    newGiftEntry.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <input type="text" name="pastGiftAmount" placeholder="금액 입력" class="amount-input" style="flex: 2; padding: 5px; border: 1px solid #ddd; border-radius: 5px; height: 40px;">
            <input type="date" name="pastGiftDate" style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 5px; height: 40px;">
            <button type="button" class="removeGiftButton" style="background-color: #f44336; color: white; border: none; padding: 0 10px; cursor: pointer; border-radius: 5px; height: 40px; line-height: 40px; text-align: center; width: auto;">삭제</button>
        </div>
    `;

    newGiftEntry.querySelector('.removeGiftButton').addEventListener('click', function () {
        container.removeChild(newGiftEntry);
    });

    newGiftEntry.querySelector('.amount-input').addEventListener('input', function (e) {
        const value = e.target.value.replace(/,/g, '');
        if (!isNaN(value)) {
            e.target.value = Number(value).toLocaleString();
        }
    });

    container.appendChild(newGiftEntry);
});

// 계산 및 결과 표시
document.getElementById('taxForm').onsubmit = function (e) {
    e.preventDefault();

    const selectedType = document.getElementById('assetType').value;
    const relationship = document.getElementById('relationship').value;
    let giftAmount = 0;

    if (selectedType === 'cash') {
        giftAmount = parseInt(document.getElementById('cashAmount').value.replace(/,/g, ''), 10) || 0;
    } else if (selectedType === 'realEstate') {
        giftAmount = parseInt(document.getElementById('realEstateValue').value.replace(/,/g, ''), 10) || 0;
    } else if (selectedType === 'stock') {
        const stockQuantity = parseInt(document.getElementById('stockQuantity')?.value || '0', 10);
        const stockPrice = parseInt(document.getElementById('stockPrice').value.replace(/,/g, ''), 10) || 0;
        giftAmount = stockQuantity * stockPrice;
    }

    const exemptionLimit = getExemptionAmount(relationship);
    const previousGiftInputs = document.getElementById('previousGifts').querySelectorAll('input');
    let previousGiftTotal = 0;

    previousGiftInputs.forEach(input => {
        const value = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        if (!isNaN(value)) {
            previousGiftTotal += value;
        }
    });

    const taxableAmount = Math.max(giftAmount - exemptionLimit - previousGiftTotal, 0);
    const giftTax = calculateGiftTax(taxableAmount);

    const giftDate = document.getElementById('giftDate').value;
    const submissionDate = document.getElementById('submissionDate').value;
    const { penalty: latePenalty, message: penaltyMessage } = calculateLatePenalty(submissionDate, giftDate, giftTax);

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <p><strong>증여세:</strong> ${giftTax.toLocaleString()}원</p>
        <p><strong>가산세:</strong> ${latePenalty.toLocaleString()}원 (${penaltyMessage})</p>
        <p><strong>최종 납부세액:</strong> ${(giftTax + latePenalty).toLocaleString()}원</p>
    `;
};
