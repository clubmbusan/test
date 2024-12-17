// 유틸리티 함수: 콤마 제거 후 숫자로 변환
function parseCurrency(value) {
    return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

// 숫자 입력 필드에 콤마 추가
document.addEventListener('input', function (event) {
    const target = event.target;

    // 콤마 적용 대상 필드 ID
const applicableFields = [
    'cashAmount',          // 현금 입력 필드
    'realEstateValue',     // 부동산 입력 필드
    'stockPrice',          // 주식 가격 입력 필드
    'fatherAmountInput',   // 모달: 부 금액 입력
    'motherAmountInput'    // 모달: 모 금액 입력
];

    // 콤마 적용 여부 확인
    if (applicableFields.includes(target.id)) {
        const rawValue = target.value.replace(/[^0-9]/g, ''); // 숫자 외 문자 제거
        if (rawValue === '') {
            target.value = ''; // 빈 값 처리
            return;
        }
        target.value = parseInt(rawValue, 10).toLocaleString(); // 숫자에 콤마 추가
    }
});
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

// 과거 증여 금액 추가 로직
document.addEventListener('DOMContentLoaded', function () {
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

        container.appendChild(newGiftEntry);
    });
});

   // 전역 변수 선언
let totalGiftAmount = 0; // 총 증여 금액
let fatherGiftAmount = 0; // 부 증여 금액
let motherGiftAmount = 0; // 모 증여 금액

// *** 결혼 증여 모달 로직 ***
document.addEventListener('DOMContentLoaded', function () {
    const marriageGiftButton = document.getElementById('marriageGiftButton');
    const marriageGiftModal = document.getElementById('marriageGiftModal');
    const closeMarriageGiftModal = document.getElementById('closeMarriageGiftModal');
    const saveMarriageGiftButton = document.getElementById('saveMarriageGiftButton');

    const fatherAmountInput = document.getElementById('fatherAmountInput'); // 부 입력 필드
    const motherAmountInput = document.getElementById('motherAmountInput'); // 모 입력 필드
    const remainingAmount = document.getElementById('remainingAmount'); // 남은 금액 표시

    // 모달 열기 버튼
    marriageGiftButton.addEventListener('click', function () {
        const cashInput = document.getElementById('cashAmount');
        totalGiftAmount = parseCurrency(cashInput.value || '0');

        if (totalGiftAmount === 0) {
            alert('증여 금액을 먼저 입력하세요.');
            return;
        }

        // 남은 금액 초기화
        remainingAmount.textContent = `${totalGiftAmount.toLocaleString()} 원`;
        marriageGiftModal.style.display = 'block';
    });

    // 부모별 금액 입력 시 남은 금액 자동 계산
    function updateRemainingAmount() {
        const fatherAmount = parseCurrency(fatherAmountInput.value || '0'); // 부 입력값
        const motherAmount = parseCurrency(motherAmountInput.value || '0'); // 모 입력값

        // 남은 금액 계산
        const remaining = Math.max(0, totalGiftAmount - (fatherAmount + motherAmount));
        remainingAmount.textContent = `${remaining.toLocaleString()} 원`;
    }

    fatherAmountInput.addEventListener('input', updateRemainingAmount);
    motherAmountInput.addEventListener('input', updateRemainingAmount);

    // 저장 버튼 클릭 (모달에서 입력값을 저장)
    saveMarriageGiftButton.addEventListener('click', function () {
        const fatherAmount = parseCurrency(fatherAmountInput.value || '0');
        const motherAmount = parseCurrency(motherAmountInput.value || '0');

        if (fatherAmount + motherAmount > totalGiftAmount) {
            alert('입력 금액이 증여 총액을 초과할 수 없습니다.');
            return;
        }

        // 각각 최대 1억 5천만 원까지만 저장
        fatherGiftAmount = Math.min(fatherAmount, 150000000);
        motherGiftAmount = Math.min(motherAmount, 150000000);

        alert(`결혼 증여 저장됨\n부: ${fatherGiftAmount.toLocaleString()} 원\n모: ${motherGiftAmount.toLocaleString()} 원`);
        marriageGiftModal.style.display = 'none';
    });

    closeMarriageGiftModal.addEventListener('click', function () {
        marriageGiftModal.style.display = 'none';
    });
});

// 결혼 공제 계산 함수
function calculateMarriageExemption() {
    const maxExemptionPerParent = 150000000; // 부모 각각 최대 1억 5천만 원

    const fatherExemption = Math.min(fatherGiftAmount, maxExemptionPerParent);
    const motherExemption = Math.min(motherGiftAmount, maxExemptionPerParent);

    return fatherExemption + motherExemption; // 총 결혼 공제 반환
}

// 최종 공제 계산 함수
function calculateExemptions() {
    const marriageExemption = calculateMarriageExemption(); // 결혼 공제 계산
    const remainingGiftAmount = Math.max(0, totalGiftAmount - marriageExemption); // 남은 금액

    // 관계 공제 계산 (최대 5천만 원)
    const relationship = document.getElementById('relationship').value;
    const relationshipExemption = Math.min(remainingGiftAmount, getExemptionAmount(relationship));

    return marriageExemption + relationshipExemption; // 결혼 공제 + 관계 공제 반환
}

// 최종 세금 계산
function calculateFinalTax() {
    const giftAmount = getGiftAmount();
    const exemptions = calculateExemptions();
    const taxableAmount = Math.max(0, giftAmount - exemptions);
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
        <p>공제 금액: ${exemptions.toLocaleString()} 원</p>
        <p>과세 금액: ${taxableAmount.toLocaleString()} 원</p>
        <p>증여세: ${giftTax.toLocaleString()} 원</p>
        <p>가산세: ${penalty.toLocaleString()} 원 (${message})</p>
        <p><strong>최종 납부세액: ${totalTax.toLocaleString()} 원</strong></p>
    `;
}

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
document.getElementById('calculateButton').addEventListener('click', calculateFinalTax);
