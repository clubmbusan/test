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

// 2. 재산 유형 선택 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function () {
    const assetType = document.getElementById('assetType'); // 재산 유형 select 요소
    if (!assetType) {
        console.error('재산 유형 선택 요소가 없습니다.');
        return;
    }

    assetType.addEventListener('change', function (e) {
        const selectedType = e.target.value; // 선택된 재산 유형

        // 재산 유형별 입력 필드
        const cashField = document.getElementById('cashInputField');
        const realEstateField = document.getElementById('realEstateInputField');
        const stockField = document.getElementById('stockInputField');

        // 모든 필드를 숨김 처리
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

// 과거 증여 금액 버튼 이벤트 (여기에 추가)
document.getElementById('addGiftButton').addEventListener('click', function () {
    const container = document.getElementById('previousGifts'); // 과거 증여 입력 컨테이너
    const newGiftEntry = document.createElement('div');
    newGiftEntry.className = 'gift-entry'; // 스타일 적용 가능
    newGiftEntry.style.marginTop = '10px'; // 간격 추가

    newGiftEntry.innerHTML = `
        <input type="text" name="pastGiftAmount" placeholder="금액 입력 (원)" class="amount-input" style="width: 150px;">
        <input type="date" name="pastGiftDate" class="date-input" style="margin-left: 10px;">
        <button type="button" class="remove-gift-button" style="background-color: #f44336; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 5px; margin-left: 10px;">삭제</button>
    `;

    // 삭제 버튼 동작 추가
    const removeButton = newGiftEntry.querySelector('.remove-gift-button');
    removeButton.addEventListener('click', function () {
        container.removeChild(newGiftEntry);
    });

    // 새 항목 추가
    container.appendChild(newGiftEntry);
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

// 가산세 계산 로직 (신고불성실 및 지연가산세 포함)
function calculateLatePenalty(submissionDate, giftDate, giftTax) {
    const giftDateObj = new Date(giftDate);
    const submissionDateObj = new Date(submissionDate);

    if (!giftDate || !submissionDate || isNaN(giftDateObj) || isNaN(submissionDateObj)) {
        return { penalty: 0, message: "날짜가 잘못 입력되었습니다." };
    }

    const dueDate = new Date(giftDateObj);
    dueDate.setMonth(dueDate.getMonth() + 3); // 기본 신고 기한: 증여일로부터 3개월

    const extendedDueDate = new Date(giftDateObj);
    extendedDueDate.setMonth(giftDateObj.getMonth() + 6); // 연장 신고 기한: 증여일로부터 6개월

    let penalty = 0;
    let message = "";

    if (submissionDateObj > dueDate) {
        const overdueDays = Math.ceil((submissionDateObj - dueDate) / (1000 * 60 * 60 * 24));

        // 신고불성실 가산세
        if (submissionDateObj <= extendedDueDate) {
            // 3개월 초과 ~ 6개월 이하: 10%
            penalty += giftTax * 0.1;
            message = `신고불성실 가산세: 10% (3~6개월 초과, ${overdueDays}일 초과)`;
        } else {
            // 6개월 초과: 20%
            penalty += giftTax * 0.2;
            message = `신고불성실 가산세: 20% (6개월 초과, ${overdueDays}일 초과)`;
        }

        // 지연가산세: 하루당 0.025%, 최대 36개월 (1%)
        const delayPenalty = Math.min(giftTax * 0.0025 * overdueDays, giftTax * 0.1);
        penalty += delayPenalty;

        message += ` + 지연가산세: ${delayPenalty.toLocaleString()}원`;
    } else {
        message = "신고 기한 내 신고 완료";
    }

    return { penalty: Math.floor(penalty), message };
}

// 최종 세금 계산 및 출력
function calculateFinalTax() {
    const giftAmount = getGiftAmount();
    const previousGifts = getPreviousGifts();
    const relationship = document.getElementById('relationship').value;

    // 공제 및 과세 금액 계산
    const { adjustedExemption, taxableAmount } = calculateTaxableAmountAndExemption(relationship, giftAmount, previousGifts);

    // 증여세 계산
    const giftTax = calculateGiftTax(taxableAmount);

    // 가산세 계산
    const giftDate = document.getElementById('giftDate').value;
    const submissionDate = document.getElementById('submissionDate').value;
    const { penalty, message } = calculateLatePenalty(submissionDate, giftDate, giftTax);

    const totalTax = giftTax + penalty;

    // 결과 출력
    document.getElementById('result').innerHTML = `
        <h3>계산 결과</h3>
        <p>증여 금액: ${giftAmount.toLocaleString()} 원</p>
        <p>공제 금액: ${adjustedExemption.toLocaleString()} 원</p>
        <p>과세 금액: ${taxableAmount.toLocaleString()} 원</p>
        <p>증여세: ${giftTax.toLocaleString()} 원</p>
        <p>가산세: ${penalty.toLocaleString()} 원 (${message})</p>
        <p><strong>최종 납부세액: ${totalTax.toLocaleString()} 원</strong></p>
    `;
}

// *** 결혼 증여 모달 로직 ***
document.addEventListener('DOMContentLoaded', function () {
    const marriageGiftButton = document.getElementById('marriageGiftButton');
    const marriageGiftModal = document.getElementById('marriageGiftModal');
    const closeMarriageGiftModal = document.getElementById('closeMarriageGiftModal');
    const saveMarriageGiftButton = document.getElementById('saveMarriageGiftButton');

    const selfParentAmountInput = document.getElementById('selfParentAmountInput');
    const inLawParentAmountInput = document.getElementById('inLawParentAmountInput');
    const remainingAmount = document.getElementById('remainingAmount');

    const cashAmount = document.getElementById('cashAmount');

    let totalGiftAmount = 0;

    // 모달 열기 버튼
    marriageGiftButton.addEventListener('click', function () {
        totalGiftAmount = parseInt(cashAmount.value.replace(/[^0-9]/g, ''), 10) || 0;

        if (totalGiftAmount === 0) {
            alert('금액을 먼저 입력하세요.');
            return;
        }

        remainingAmount.textContent = `${totalGiftAmount.toLocaleString()} 원`;
        marriageGiftModal.style.display = 'block';
    });

    // 부모별 금액 입력 시 남은 금액 자동 계산
    function updateRemainingAmount() {
        const selfAmount = parseInt(selfParentAmountInput.value.replace(/[^0-9]/g, ''), 10) || 0;
        const inLawAmount = parseInt(inLawParentAmountInput.value.replace(/[^0-9]/g, ''), 10) || 0;

        const remaining = Math.max(0, totalGiftAmount - (selfAmount + inLawAmount));
        remainingAmount.textContent = `${remaining.toLocaleString()} 원`;
    }

    selfParentAmountInput.addEventListener('input', updateRemainingAmount);
    inLawParentAmountInput.addEventListener('input', updateRemainingAmount);

    // 저장 버튼 클릭
    saveMarriageGiftButton.addEventListener('click', function () {
        const selfAmount = parseInt(selfParentAmountInput.value.replace(/[^0-9]/g, ''), 10) || 0;
        const inLawAmount = parseInt(inLawParentAmountInput.value.replace(/[^0-9]/g, ''), 10) || 0;

        if (selfAmount + inLawAmount > totalGiftAmount) {
            alert('입력 금액이 증여 총액을 초과할 수 없습니다.');
            return;
        }

        alert(`결혼 증여 저장됨\n자가 부모: ${selfAmount.toLocaleString()} 원\n처가 부모: ${inLawAmount.toLocaleString()} 원`);
        marriageGiftModal.style.display = 'none';
    });

    // 모달 닫기 버튼
    closeMarriageGiftModal.addEventListener('click', function () {
        marriageGiftModal.style.display = 'none';
    });
});

// 계산하기 버튼 이벤트
document.getElementById('calculateButton').addEventListener('click', calculateFinalTax);

// 증여세 신고 버튼 클릭 이벤트
document.getElementById('donationTaxButton').addEventListener('click', function () {
    const giftDateContainer = document.getElementById('giftDateContainer');
    const submissionDateContainer = document.getElementById('submissionDateContainer');
    const extendedPeriodContainer = document.getElementById('extendedPeriodContainer');

    // 숨겨진 입력 필드 토글 (보이기/숨기기)
    const isVisible = giftDateContainer.style.display === 'block';
    const newDisplay = isVisible ? 'none' : 'block';

    giftDateContainer.style.display = newDisplay;
    submissionDateContainer.style.display = newDisplay;
    extendedPeriodContainer.style.display = newDisplay;
});

