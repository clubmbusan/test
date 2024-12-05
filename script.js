// 증여세 누진세 계산 로직
// 각 증여 금액 구간에 따른 세율 및 공제액을 정의합니다.
const taxBrackets = [
    { limit: 10000000, rate: 10, deduction: 0 },          // 1천만 원 이하 10%
    { limit: 100000000, rate: 20, deduction: 10000000 },  // 1억 원 이하 20%
    { limit: 500000000, rate: 30, deduction: 60000000 },  // 5억 원 이하 30%
    { limit: 1000000000, rate: 40, deduction: 160000000 },// 10억 원 이하 40%
    { limit: 3000000000, rate: 50, deduction: 460000000 },// 30억 원 이하 50%
    { limit: Infinity, rate: 60, deduction: 960000000 }   // 30억 원 초과 60%
];

// 금액 입력 시 콤마 처리
// 사용자가 금액을 입력할 때 자동으로 콤마를 추가합니다.
document.addEventListener('input', function (e) {
    if (['cashAmount', 'realEstateValue', 'stockPrice', 'amount'].includes(e.target.id)) {
        e.target.value = e.target.value
            .replace(/[^0-9]/g, '') // 숫자 외 문자 제거
            .replace(/\B(?=(\d{3})+(?!\d))/g, ","); // 3자리마다 콤마 추가
    }
});

// 관계별 공제 한도 계산
// 증여 관계에 따라 공제 한도를 설정합니다.
function getExemptionAmount(relationship) {
    const exemptions = {
        'adultChild': 50000000,       // 성년 자녀 공제: 5천만 원
        'minorChild': 20000000,       // 미성년 자녀 공제: 2천만 원
        'spouse': 600000000,          // 배우자 공제: 6억 원
        'sonInLawDaughterInLaw': 50000000, // 사위/며느리 공제: 5천만 원
        'other': 1000000              // 타인 공제: 1천만 원
    };
    return exemptions[relationship] || 0; // 관계가 정의되지 않으면 기본값 0 반환
}

// 증여세 계산 로직
// 누진세율에 따라 증여세를 계산합니다.
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
    return Math.max(tax, 0); // 세금이 음수로 나오지 않도록 처리
}

// 가산세 계산 로직
// 신고 기한을 초과한 경우 가산세를 계산합니다.
function calculateLatePenalty(submissionDate, giftDate, giftTax) {
    const giftDateObj = new Date(giftDate);
    const submissionDateObj = new Date(submissionDate);

    // 날짜가 올바르지 않을 경우 처리
    if (!giftDate || !submissionDate || isNaN(giftDateObj) || isNaN(submissionDateObj)) {
        return { penalty: 0, message: "날짜가 잘못 입력되었습니다." };
    }

    // 신고 기한 계산 (증여일 + 3개월)
    const dueDate = new Date(giftDateObj);
    dueDate.setMonth(dueDate.getMonth() + 3);

    // 신고 기한 초과 여부에 따른 가산세 계산
    if (submissionDateObj <= dueDate) {
        return { penalty: 0, message: "신고 기한 내 신고 완료" };
    }

    // 연장된 신고 기한 (증여일 + 6개월)
    const extendedDueDate = new Date(giftDateObj);
    extendedDueDate.setMonth(extendedDueDate.getMonth() + 6);

    if (submissionDateObj <= extendedDueDate) {
        return { penalty: giftTax * 0.1, message: "신고 기한 초과 (3~6개월)" };
    }

    return { penalty: giftTax * 0.2, message: "신고 기한 초과 (6개월 초과)" };
}

// 과거 증여 금액 추가 버튼
// 사용자가 버튼을 클릭하면 금액 및 날짜 입력 필드가 생성됩니다.
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

    // 삭제 버튼 동작 추가
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
// JavaScript 로드가 HTML 로드 이후에 이루어지도록 설정
document.addEventListener('DOMContentLoaded', function () {
    // assetType 요소를 참조하고 Console에 출력
    const assetType = document.getElementById('assetType');
    console.log('assetType 참조 확인:', assetType); // assetType 요소 확인

    if (!assetType) {
        console.error('assetType 요소를 찾을 수 없습니다.'); // 오류 메시지
        return; // assetType이 없으면 실행 중지
    }

    // 재산 유형 선택 시 입력 필드 변경
    assetType.addEventListener('change', function (e) {
        console.log('재산 유형 선택 이벤트 호출됨:', e.target.value); // 선택된 값 확인

        const selectedType = e.target.value;

        const cashField = document.getElementById('cashInputField');
        const realEstateField = document.getElementById('realEstateInputField');
        const stockField = document.getElementById('stockInputField');

        // 모든 입력 필드를 초기화 (숨김 처리)
        cashField.style.display = 'none';
        realEstateField.style.display = 'none';
        stockField.style.display = 'none';

        // 선택된 유형에 따라 필드 표시
        if (selectedType === 'cash') {
            cashField.style.display = 'block';
        } else if (selectedType === 'realEstate') {
            realEstateField.style.display = 'block';
        } else if (selectedType === 'stock') {
            stockField.style.display = 'block';
        }
    });
});

// 계산 및 결과 표시
// 사용자 입력 데이터를 바탕으로 최종 결과를 계산하고 표시합니다.
document.getElementById('taxForm').onsubmit = function (e) {
    e.preventDefault();

    const selectedType = document.getElementById('assetType').value; // 재산 유형 선택
    const relationship = document.getElementById('relationship').value; // 증여 관계
    let giftAmount = 0;

    // 재산 유형에 따른 금액 계산
    if (selectedType === 'cash') {
        // 현금 유형: 사용자가 입력한 현금 금액
        giftAmount = parseCurrency(document.getElementById('cashAmount').value || '0');
    } else if (selectedType === 'realEstate') {
        // 부동산 유형: 사용자가 입력한 부동산 평가액
        giftAmount = parseCurrency(document.getElementById('realEstateValue').value || '0');
    } else if (selectedType === 'stock') {
        // 주식 유형: 주식 수량과 주식 1주당 가격을 곱한 금액
        const stockQuantity = parseInt(document.getElementById('stockQuantity').value || '0', 10);
        const stockPrice = parseCurrency(document.getElementById('stockPrice').value || '0');
        giftAmount = stockQuantity * stockPrice;
    } else {
        giftAmount = 0; // 재산 유형이 선택되지 않은 경우
    }
   
    // 관계별 공제 한도 계산
    const exemptionLimit = getExemptionAmount(relationship);

    // 과거 증여 금액 합산
    const previousGiftInputs = document.getElementById('previousGifts').querySelectorAll('input');
    let previousGiftTotal = 0;

    previousGiftInputs.forEach(input => {
        const value = parseCurrency(input.value || '0');
        if (!isNaN(value)) {
            previousGiftTotal += value; // 과거 증여 금액을 누적
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
// 주식 총 금액 자동 계산
document.getElementById('stockInputField').addEventListener('input', function () {
    const stockQuantityInput = document.getElementById('stockQuantity');
    const stockPriceInput = document.getElementById('stockPrice');
    const stockTotalInput = document.getElementById('stockTotal');

    // 매수량
    const stockQuantity = parseInt(stockQuantityInput.value.replace(/,/g, '') || '0', 10);

    // 주당 가격 (콤마 처리 및 숫자로 변환)
    const stockPrice = parseCurrency(stockPriceInput.value || '0');

    // 총 금액 계산
    const total = stockQuantity * stockPrice;

    // 콤마 추가 및 표시
    stockPriceInput.value = stockPrice.toLocaleString();
    stockTotalInput.value = total.toLocaleString() + ' 원';

    // 계산된 총 금액을 stockTotal 필드에 표시
    stockTotalInput.value = total.toLocaleString() + ' 원';
});

// parseCurrency 함수 정의
function parseCurrency(value) {
    return parseInt(value.replace(/,/g, ''), 10) || 0; // 콤마 제거 후 정수 변환
}
