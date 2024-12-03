// 증여세 누진세 계산 로직
const taxBrackets = [
    { limit: 100000000, rate: 10, deduction: 0 },
    { limit: 500000000, rate: 20, deduction: 10000000 },
    { limit: 1000000000, rate: 30, deduction: 60000000 },
    { limit: 3000000000, rate: 40, deduction: 160000000 },
    { limit: Infinity, rate: 50, deduction: 460000000 }
];
// 관계별 공제 한도 정의
const exemptionLimits = {
    adult: 50000000,         // 기본 성년자 공제
    minor: 20000000,         // 미성년자 공제
    spouse: 600000000,       // 배우자 공제
    sonInLaw: 50000000,      // 사위, 며느리 공제
    others: 10000000         // 기타 타인 공제
};
// 금액 입력 시 콤마 처리
function parseCurrency(value) {
    return parseInt(value.replace(/,/g, ''), 10) || 0;
}

document.addEventListener('input', function (e) {
    if (e.target.id === 'cashAmount' || e.target.id === 'realEstateValue' || e.target.id === 'stockPrice') {
        e.target.value = e.target.value
            .replace(/[^0-9]/g, '') // 숫자 외 문자 제거
            .replace(/\B(?=(\d{3})+(?!\d))/g, ','); // 콤마 추가
    }
});
// 관계 선택에 따른 공제 한도 결정
const relationship = document.getElementById('relationship').value;
console.log('선택된 관계:', relationship); // 관계 값 확인

const exemptionLimit = exemptionLimits[relationship] || 0;
console.log('적용된 공제 한도:', exemptionLimit); // 공제 한도 확인

// 과세 표준 계산
const taxableAmount = Math.max(giftAmount - exemptionLimit - previousGiftTotal, 0);
console.log('과세 표준:', taxableAmount); // 과세 표준 확인

// 증여세 계산
const giftTax = calculateGiftTax(taxableAmount);
console.log('계산된 증여세:', giftTax); // 계산된 증여세 확인
// 가산세 계산 (수정된 함수)
function calculateLatePenalty(submissionDate, giftDate, giftTax) {
    const giftDateObj = new Date(giftDate);
    const submissionDateObj = new Date(submissionDate);

    if (!giftDate || !submissionDate || isNaN(giftDateObj) || isNaN(submissionDateObj)) {
        return 0; // 날짜가 없거나 잘못된 경우 가산세 없음
    }

    // 신고 기한 계산 (증여일 + 3개월)
    const dueDate = new Date(giftDateObj);
    dueDate.setMonth(dueDate.getMonth() + 3); // 3개월 추가

    // 날짜 비교
    if (submissionDateObj <= dueDate) {
        return 0; // 신고 기한 내 가산세 없음
    }

    // 연장된 신고 기한 (증여일 + 6개월)
    const extendedDueDate = new Date(giftDateObj);
    extendedDueDate.setMonth(extendedDueDate.getMonth() + 6);

    if (submissionDateObj <= extendedDueDate) {
        return giftTax * 0.1; // 3개월 초과 ~ 6개월 이내: 가산세 10%
    }

    return giftTax * 0.2; // 6개월 초과: 가산세 20%
}

// 증여세 계산 로직
function calculateGiftTax(taxableAmount) {
    let tax = 0;
    let previousLimit = 0; // 이전 구간의 한도를 초기화

    // 누진세율을 각 구간에 맞게 계산
    for (let i = 0; i < taxBrackets.length; i++) {
        const bracket = taxBrackets[i];

        // 현재 구간의 금액이 해당 구간의 한도를 초과하면 초과 부분에 대해 세금 계산
        if (taxableAmount > bracket.limit) {
            tax += (bracket.limit - previousLimit) * (bracket.rate / 100); // 한 구간 내 금액에 대해 세금 적용
            previousLimit = bracket.limit; // 이전 한도 갱신
        } else {
            tax += (taxableAmount - previousLimit) * (bracket.rate / 100); // 마지막 구간의 나머지 금액에 대해 세금 적용
            break;
        }
    }
    return Math.max(tax, 0); // 세금이 음수로 나오지 않도록 0 이상으로 처리
}

// 재산 유형에 따라 입력 필드 표시
document.getElementById('assetType').addEventListener('change', function () {
    const selectedType = this.value;
    const additionalFields = document.getElementById('additionalFields');
    additionalFields.innerHTML = ''; // 기존 필드 초기화

    if (selectedType === 'cash') {
        additionalFields.innerHTML = `
            <label for="cashAmount">현금 금액 (원):</label>
            <input type="text" id="cashAmount" placeholder="예: 10,000,000">
        `;
    } else if (selectedType === 'realEstate') {
        additionalFields.innerHTML = `
            <label for="realEstateValue">부동산 공시가격 (원):</label>
            <input type="text" id="realEstateValue" placeholder="예: 500,000,000">
        `;
    } else if (selectedType === 'stock') {
        additionalFields.innerHTML = `
            <label for="stockQuantity">주식 수량:</label>
            <input type="number" id="stockQuantity" placeholder="예: 100">
            <label for="stockPrice">증여일 기준 주가 (원):</label>
            <input type="text" id="stockPrice" placeholder="예: 50,000">
        `;
    }
});

// 과거 증여 금액 추가
document.getElementById('addGiftButton').addEventListener('click', function () {
    const container = document.getElementById('previousGifts');
    const newGiftEntry = document.createElement('div');
    newGiftEntry.style.marginBottom = '10px'; // 각 항목 간격 설정
    newGiftEntry.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <input type="text" name="pastGiftAmount" placeholder="금액 입력"
                class="amount-input"
                style="flex: 2; padding: 5px; border: 1px solid #ddd; border-radius: 5px; height: 40px;">
            <input type="date" name="pastGiftDate"
                style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 5px; height: 40px;">
            <button type="button" class="removeGiftButton"
                style="background-color: #f44336; color: white; border: none; padding: 0 10px; cursor: pointer; 
                border-radius: 5px; height: 40px; line-height: 40px; text-align: center; width: auto;">삭제</button>
        </div>
    `;

    // 삭제 버튼 동작 추가
    newGiftEntry.querySelector('.removeGiftButton').addEventListener('click', function () {
        container.removeChild(newGiftEntry);
    });

    // 금액 입력 필드에 콤마 처리 추가
    newGiftEntry.querySelector('.amount-input').addEventListener('input', function (e) {
        const value = e.target.value.replace(/,/g, ''); // 기존 콤마 제거
        if (!isNaN(value)) {
            e.target.value = Number(value).toLocaleString(); // 숫자를 콤마로 포맷팅
        }
    });

    container.appendChild(newGiftEntry); // 컨테이너에 입력 필드 추가
});


// 결과 출력
document.getElementById('taxForm').onsubmit = function (e) {
    e.preventDefault();

    // 재산 유형에 따른 금액 계산
    const selectedType = document.getElementById('assetType').value;
    let giftAmount = 0;
// 선택된 재산 유형에 따라 증여 금액 계산
    if (selectedType === 'cash') {
        giftAmount = parseCurrency(document.getElementById('cashAmount')?.value || '0');
    } else if (selectedType === 'realEstate') {
        giftAmount = parseCurrency(document.getElementById('realEstateValue')?.value || '0');
    } else if (selectedType === 'stock') {
        const stockQuantity = parseInt(document.getElementById('stockQuantity')?.value || '0', 10);
        const stockPrice = parseCurrency(document.getElementById('stockPrice')?.value || '0');
        giftAmount = stockQuantity * stockPrice;
    }

    // 과거 증여 금액 합산
const previousGiftInputs = document.getElementById('previousGifts').querySelectorAll('input');
let previousGiftTotal = 0;
previousGiftInputs.forEach(input => {
    const value = parseCurrency(input.value || '0');
    if (!isNaN(value)) {
        previousGiftTotal += value;
    }
});

// 관계별 공제 한도 정의
const exemptionLimits = {
    child: 50000000,        // 성년 자녀
    minorChild: 20000000,   // 미성년 자녀
    spouse: 600000000,      // 배우자
    inLaw: 50000000,        // 사위/며느리
    other: 10000000         // 기타 타인
};

// 관계 선택에 따른 공제 한도 결정
const relationship = document.getElementById('relationship').value;
console.log('선택된 관계:', relationship); // 관계 값 확인

const exemptionLimit = exemptionLimits[relationship] || 0;
console.log('적용된 공제 한도:', exemptionLimit); // 공제 한도 확인

// 과세 표준 계산
const taxableAmount = Math.max(giftAmount - exemptionLimit - previousGiftTotal, 0);
console.log('과세 표준:', taxableAmount); // 과세 표준 확인

// 증여세 계산
const giftTax = calculateGiftTax(taxableAmount);
console.log('계산된 증여세:', giftTax); // 계산된 증여세 확인

   
    // 가산세 계산
    const giftDate = document.getElementById('giftDate')?.value;
    const submissionDate = document.getElementById('submissionDate')?.value;
    const latePenalty = calculateLatePenalty(submissionDate, giftDate, giftTax);

    // 결과 표시
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <p><strong>증여세:</strong> ${giftTax.toLocaleString()}원</p>
        <p><strong>가산세:</strong> ${latePenalty.toLocaleString()}원</p>
        <p><strong>최종 납부세액:</strong> ${(giftTax + latePenalty).toLocaleString()}원</p>
    `;
};
