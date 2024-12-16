// 유틸리티 함수: 콤마 제거 후 숫자로 변환
function parseCurrency(value) {
    return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
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

// 재산 유형 선택 이벤트 리스너
document.addEventListener('DOMContentLoaded', function () {
    const assetType = document.getElementById('assetType'); // 재산 유형 select 요소
    assetType.addEventListener('change', function (e) {
        const selectedType = e.target.value;

        const cashField = document.getElementById('cashInputField');
        const realEstateField = document.getElementById('realEstateInputField');
        const stockField = document.getElementById('stockInputField');

        // 모든 필드를 숨김 처리
        cashField.style.display = 'none';
        realEstateField.style.display = 'none';
        stockField.style.display = 'none';

        // 선택된 유형에 따라 필드 표시
        if (selectedType === 'cash') cashField.style.display = 'block';
        else if (selectedType === 'realEstate') realEstateField.style.display = 'block';
        else if (selectedType === 'stock') stockField.style.display = 'block';
    });
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
        giftAmount = stockQuantity * stockPrice;
    }
    return giftAmount;
}

// 누진세 계산
function calculateGiftTax(taxableAmount) {
    const taxBrackets = [
        { limit: 100000000, rate: 0.1, deduction: 0 },
        { limit: 500000000, rate: 0.2, deduction: 10000000 },
        { limit: 1000000000, rate: 0.3, deduction: 60000000 },
        { limit: 3000000000, rate: 0.4, deduction: 160000000 },
        { limit: Infinity, rate: 0.5, deduction: 460000000 }
    ];

    let tax = 0;
    let previousLimit = 0;

    for (const bracket of taxBrackets) {
        if (taxableAmount > bracket.limit) {
            tax += (bracket.limit - previousLimit) * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            tax += (taxableAmount - previousLimit) * bracket.rate;
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
    dueDate.setMonth(dueDate.getMonth() + 3);

    const extendedDueDate = new Date(giftDateObj);
    extendedDueDate.setMonth(giftDateObj.getMonth() + 6);

    let penalty = 0;
    let message = "";

    if (submissionDateObj > dueDate) {
        const overdueDays = Math.ceil((submissionDateObj - dueDate) / (1000 * 60 * 60 * 24));

        if (submissionDateObj <= extendedDueDate) {
            penalty += giftTax * 0.1;
            message = `신고불성실 가산세: 10% (${overdueDays}일 초과)`;
        } else {
            penalty += giftTax * 0.2;
            message = `신고불성실 가산세: 20% (${overdueDays}일 초과)`;
        }

        const delayPenalty = Math.min(giftTax * 0.0025 * overdueDays, giftTax * 0.1);
        penalty += delayPenalty;
        message += ` + 지연가산세: ${delayPenalty.toLocaleString()}원`;
    } else {
        message = "신고 기한 내 신고 완료";
    }

    return { penalty: Math.floor(penalty), message };
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

    let totalGiftAmount = 0;
    let marriageGiftSelf = 0;
    let marriageGiftInLaw = 0;

    marriageGiftButton.addEventListener('click', function () {
        totalGiftAmount = parseCurrency(document.getElementById('cashAmount').value || '0');
        if (totalGiftAmount === 0) {
            alert('금액을 먼저 입력하세요.');
            return;
        }

        remainingAmount.textContent = `${totalGiftAmount.toLocaleString()} 원`;
        marriageGiftModal.style.display = 'block';
    });

    function updateRemainingAmount() {
        const selfAmount = parseCurrency(selfParentAmountInput.value || '0');
        const inLawAmount = parseCurrency(inLawParentAmountInput.value || '0');
        const remaining = Math.max(0, totalGiftAmount - (selfAmount + inLawAmount));
        remainingAmount.textContent = `${remaining.toLocaleString()} 원`;
    }

    selfParentAmountInput.addEventListener('input', updateRemainingAmount);
    inLawParentAmountInput.addEventListener('input', updateRemainingAmount);

    saveMarriageGiftButton.addEventListener('click', function () {
        const selfAmount = parseCurrency(selfParentAmountInput.value || '0');
        const inLawAmount = parseCurrency(inLawParentAmountInput.value || '0');

        if (selfAmount + inLawAmount > totalGiftAmount) {
            alert('입력 금액이 증여 총액을 초과할 수 없습니다.');
            return;
        }

        marriageGiftSelf = selfAmount;
        marriageGiftInLaw = inLawAmount;

        marriageGiftModal.style.display = 'none';
    });

    closeMarriageGiftModal.addEventListener('click', function () {
        marriageGiftModal.style.display = 'none';
    });
});

function calculateExemptions() {
    const marriageExemption = Math.min(marriageGiftSelf + marriageGiftInLaw, 400000000);
    const relationship = document.getElementById('relationship').value;
    const relationshipExemption = marriageGiftSelf + marriageGiftInLaw > 0 ? 0 : getExemptionAmount(relationship);

    return marriageExemption + relationshipExemption;
}

function calculateFinalTax() {
    const giftAmount = getGiftAmount();
    const exemptions = calculateExemptions();
    const taxableAmount = Math.max(0, giftAmount - exemptions);
    const giftTax = calculateGiftTax(taxableAmount);

    const giftDate = document.getElementById('giftDate').value;
    const submissionDate = document.getElementById('submissionDate').value;
    const { penalty, message } = calculateLatePenalty(submissionDate, giftDate, giftTax);

    const totalTax = giftTax + penalty;

    document.getElementById('result').innerHTML = `
        <h3>계산 결과</h3>
        <p>증여 금액: ${giftAmount.toLocaleString()} 원</p>
        <p>공제 금액: ${exemptions.toLocaleString()} 원</p>
        <p>과세 금액: ${taxableAmount.toLocaleString()} 원</p>
        <p>증여세: ${giftTax.toLocaleString()} 원</p>
        <p>가산세: ${penalty.toLocaleString()} 원 (${message})</p>
        <p><strong>최종 납부세액: ${totalTax.toLocaleString()} 원</strong></p>
    `;
}

document.getElementById('calculateButton').addEventListener('click', calculateFinalTax);
