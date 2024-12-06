// 관계별 공제 한도 계산
function getExemptionAmount(relationship) {
    const exemptions = {
        'adultChild': 50000000,       // 성년 자녀: 5천만 원
        'minorChild': 20000000,       // 미성년 자녀: 2천만 원
        'spouse': 600000000,          // 배우자: 6억 원
        'sonInLawDaughterInLaw': 50000000, // 사위/며느리: 5천만 원
        'other': 10000000              // 타인: 1천만 원
    };

    return exemptions[relationship] || 0; // 기본값 반환
}

// 금액 입력 시 콤마 처리
// 사용자가 금액을 입력할 때 자동으로 콤마를 추가합니다.
document.addEventListener('input', function (e) {
    // 해당 ID 또는 클래스가 적용된 필드만 처리
    if (['cashAmount', 'realEstateValue', 'stockPrice', 'amount'].includes(e.target.id) || e.target.classList.contains('amount-input')) {
        const inputField = e.target;

        // 현재 입력값에서 숫자 외 모든 문자 제거
        const rawValue = inputField.value.replace(/[^0-9]/g, ''); // 숫자만 남김

        if (rawValue === '') {
            inputField.value = ''; // 빈 값 처리
            return;
        }

        // 콤마 추가하여 포맷팅
        const formattedValue = parseInt(rawValue, 10).toLocaleString();

        // 필드 값 업데이트
        inputField.value = formattedValue;

        // 커서 위치 복원 (선택적으로 추가)
        const cursorPosition = inputField.selectionStart;
        inputField.setSelectionRange(cursorPosition, cursorPosition);
    }
});

// 공제 및 과세 금액 계산 함수
function calculateTaxableAmountAndExemption(relationship, giftAmount, previousGifts) {
    if (giftAmount <= 0) return { adjustedExemption: 0, taxableAmount: 0 };

    const adjustedExemption = calculateAdjustedExemption(relationship, previousGifts);
    const taxableAmount = Math.max(giftAmount - adjustedExemption, 0);

    return { adjustedExemption, taxableAmount };
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
function calculateAdjustedExemption(relationship, previousGifts) {
    const exemption = getExemptionAmount(relationship);

    const pastGifts = previousGifts.filter(gift => {
        const giftDate = new Date(gift.date);
        const today = new Date();
        return giftDate.getFullYear() === today.getFullYear();
    });

    const totalPastGifts = pastGifts.reduce((sum, gift) => sum + gift.amount, 0);
    const adjustedExemption = exemption - totalPastGifts;

    return Math.max(adjustedExemption, 0);
}

// 누진세 계산
function calculateGiftTax(taxableAmount) {
    const taxBrackets = [
        { limit: 100000000, rate: 10, deduction: 0 },           // 1억 원 이하 10%
        { limit: 500000000, rate: 20, deduction: 10000000 },    // 5억 원 이하 20%
        { limit: 3000000000, rate: 30, deduction: 70000000 },   // 30억 원 이하 30%
        { limit: Infinity, rate: 50, deduction: 470000000 }     // 30억 초과 50%
    ];

    let tax = 0;
    let previousLimit = 0;

    for (const bracket of taxBrackets) {
        if (taxableAmount > bracket.limit) {
            // 구간을 초과하면, 해당 구간까지만 계산
            tax += (bracket.limit - previousLimit) * (bracket.rate / 100);
            previousLimit = bracket.limit;
        } else {
            // 마지막 구간에 대해 계산 (공제액 차감)
            tax += (taxableAmount - previousLimit) * (bracket.rate / 100);
            tax -= bracket.deduction;  // 공제액 차감
            break;
        }
    }

    return Math.max(tax, 0); // 음수 방지
}

// 최종 세금 계산 및 출력 함수
function calculateFinalTax() {
    // 관계 입력 (select 요소에서 값 가져오기)
    const relationshipSelect = document.getElementById('relationship');
    const relationship = relationshipSelect ? relationshipSelect.value : 'adultChild'; // 기본값 'adultChild'

    // 사용자가 입력한 금액을 가져옵니다.
    const giftAmount = parseCurrency(document.querySelector('.amount-input').value || '0');

    // 과거 증여 내역을 가져옵니다.
    const previousGifts = getPreviousGifts();

    // 공제 및 과세 금액 계산
    const { adjustedExemption, taxableAmount } = calculateTaxableAmountAndExemption(relationship, giftAmount, previousGifts);

    // 누진세 계산
    const giftTax = calculateGiftTax(taxableAmount); // 누진세 계산
    const finalTax = giftTax;

    // 결과 출력
    document.getElementById('finalTax').innerText = `최종 납부세액: ${finalTax.toLocaleString()} 원`;
}

// 금액 포맷팅 함수
function parseCurrency(value) {
    return parseInt(value.replace(/[^0-9]/g, ''), 10);
}

// 증여세 계산 버튼에 이벤트 리스너 추가
document.querySelector('#calculateButton').addEventListener('click', calculateFinalTax);

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

// 과세 금액 실시간 업데이트 함수
function updateDynamicTaxableAmount() {
    const giftAmount = parseCurrency(document.getElementById('cashAmount')?.value || '0'); // 현재 증여 금액
    const relationship = document.getElementById('relationship').value; // 선택된 관계

    const previousGiftInputs = document.getElementById('previousGifts').querySelectorAll('.amount-input');
    const previousGiftDates = document.getElementById('previousGifts').querySelectorAll('input[type="date"]');
    let previousGifts = [];

    previousGiftInputs.forEach((input, index) => {
        const amount = parseCurrency(input.value || '0');
        const date = previousGiftDates[index]?.value || null;
        if (!isNaN(amount) && date) {
            previousGifts.push({ amount, date });
        }
    });

    // 관계별 공제 계산
    const adjustedExemption = calculateAdjustedExemption(relationship, previousGifts);

    // 과세 금액 계산
    const taxableAmount = Math.max(giftAmount - adjustedExemption, 0);

    // 과표 업데이트
    const taxableAmountInput = document.getElementById('calculatedTaxableAmount');
    if (taxableAmountInput) {
        taxableAmountInput.value = taxableAmount.toLocaleString(); // 과세 금액 업데이트
    }
}

// 과거 증여 금액 추가 버튼 동작
document.getElementById('addGiftButton').addEventListener('click', function () {
    const container = document.getElementById('previousGifts'); // 과거 증여 입력 컨테이너
    const newGiftEntry = document.createElement('div');
    newGiftEntry.className = 'gift-entry'; // 스타일 적용 가능
    newGiftEntry.innerHTML = `
        <input type="text" name="pastGiftAmount" placeholder="금액 입력 (원)" class="amount-input">
        <input type="date" name="pastGiftDate" class="date-input">
        <button type="button" class="remove-gift-button" style="background-color: #f44336; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 5px;">삭제</button>
    `;

    // 삭제 버튼 동작 추가
    const removeButton = newGiftEntry.querySelector('.remove-gift-button');
    removeButton.addEventListener('click', function () {
        container.removeChild(newGiftEntry);
        updateDynamicTaxableAmount(); // 과세 금액 업데이트
    });

    // 금액 입력 필드 이벤트 추가 (콤마 추가)
    const amountInput = newGiftEntry.querySelector('.amount-input');
    amountInput.addEventListener('input', function () {
        const value = amountInput.value.replace(/,/g, '');
        if (!isNaN(value)) {
            amountInput.value = Number(value).toLocaleString(); // 콤마 추가
        }
        updateDynamicTaxableAmount(); // 과세 금액 업데이트
    });

    // 새 항목 추가
    container.appendChild(newGiftEntry);

    // 과세 금액 초기 업데이트
    updateDynamicTaxableAmount();
});

// JavaScript 로드가 HTML 로드 이후에 이루어지도록 설정
document.addEventListener('DOMContentLoaded', function () {
    // assetType 요소를 참조하고 Console에 출력
    const assetType = document.getElementById('assetType');
    
    if (!assetType) {
        console.error('assetType 요소를 찾을 수 없습니다.'); // 오류 메시지
        return; // assetType이 없으면 실행 중지
    }

    // 재산 유형 선택 시 입력 필드 변경
    assetType.addEventListener('change', function (e) {
       
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

// 계산하기 버튼 클릭 이벤트 추가
document.getElementById('calculateButton').addEventListener('click', function () {
    const calculateButton = document.getElementById('calculateButton');
    calculateButton.style.backgroundColor = '#87CEEB'; // 하늘색
    calculateButton.style.color = 'white'; // 버튼 텍스트 색상 유지
    calculateButton.textContent = '계산하기'; // 텍스트는 항상 "계산하기"로 유지

    // [계산 로직 시작] 사용자가 입력한 데이터를 기반으로 계산을 시작합니다.
    const selectedType = document.getElementById('assetType').value; // 재산 유형 선택
    const relationship = document.getElementById('relationship').value; // 증여 관계
    let giftAmount = 0;

    // [재산 유형에 따른 금액 계산] 현금, 부동산, 주식에 따라 증여 금액 계산
    if (selectedType === 'cash') {
        giftAmount = parseCurrency(document.getElementById('cashAmount').value || '0');
    } else if (selectedType === 'realEstate') {
        giftAmount = parseCurrency(document.getElementById('realEstateValue').value || '0');
    } else if (selectedType === 'stock') {
        const stockQuantity = parseInt(document.getElementById('stockQuantity').value || '0', 10);
        const stockPrice = parseCurrency(document.getElementById('stockPrice').value || '0');
        giftAmount = stockQuantity * stockPrice;
    }

    // [공제 금액 및 과세 금액 계산]
    const previousGifts = getPreviousGifts(); // 과거 증여 데이터를 배열로 가져오는 함수
    const { adjustedExemption, taxableAmount } = calculateTaxableAmountAndExemption(relationship, giftAmount, previousGifts);

    // [증여세 계산]
    const giftTax = calculateGiftTax(taxableAmount);

    // [가산세 계산]
    const giftDate = document.getElementById('giftDate').value;
    const submissionDate = document.getElementById('submissionDate').value;
    const { penalty: latePenalty, message: penaltyMessage } = calculateLatePenalty(submissionDate, giftDate, giftTax);

    // [결과 출력] 계산 과정 및 결과를 화면에 출력
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <h3>계산 과정</h3>
        <p><strong>입력된 증여 금액:</strong> ${giftAmount.toLocaleString()}원</p>
        <p><strong>공제 금액:</strong> ${adjustedExemption.toLocaleString()}원</p>
        <p><strong>과세 금액:</strong> ${taxableAmount.toLocaleString()}원</p>
        <p><strong>증여세 계산:</strong> ${giftTax.toLocaleString()}원</p>
        <p><strong>가산세 계산:</strong> ${latePenalty.toLocaleString()}원 (${penaltyMessage})</p>
        <h3>최종 결과</h3>
        <p><strong>최종 납부세액:</strong> ${(giftTax + latePenalty).toLocaleString()}원</p>
    `;
});

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
