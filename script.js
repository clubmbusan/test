// 유틸리티 함수: 콤마 제거 후 숫자로 변환
function parseCurrency(value) {
    return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

// 숫자 입력 필드에 콤마 추가
document.addEventListener('input', function (event) {
    const target = event.target;

    // 콤마 적용 대상 필드 ID
    const applicableFields = [
        'cashAmount',           // 현금 입력 필드
        'realEstateValue',      // 부동산 입력 필드
        'stockPrice',           // 주식 가격 입력 필드
        'mixedCashAmount',      // 복합 재산: 현금
        'mixedRealEstateValue', // 복합 재산: 부동산
        'mixedStockPrice',      // 복합 재산: 주식 1주당 가격
        'fatherAmountInput',    // 모달: 부 금액 입력
        'motherAmountInput'     // 모달: 모 금액 입력
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

// 재산 유형 선택 이벤트 리스너
document.addEventListener('DOMContentLoaded', function () {
    const assetType = document.getElementById('assetType');

    // 재산 유형 드롭다운 이벤트 추가
    assetType.addEventListener('change', function () {
        const selectedType = this.value;

        // 각 재산 유형별 필드
        const cashField = document.getElementById('cashInputField');
        const realEstateField = document.getElementById('realEstateInputField');
        const stockField = document.getElementById('stockInputField');
        const mixedField = document.getElementById('mixedInputField');

        // 모든 입력 필드 숨김
        cashField.style.display = 'none';
        realEstateField.style.display = 'none';
        stockField.style.display = 'none';
        mixedField.style.display = 'none';

        // 선택된 유형에 따라 필드 표시
        if (selectedType === 'mixed') {
            mixedField.style.display = 'block'; // 복합재산 필드 표시
        } else if (selectedType === 'cash') {
            cashField.style.display = 'block'; // 현금 필드 표시
        } else if (selectedType === 'realEstate') {
            realEstateField.style.display = 'block'; // 부동산 필드 표시
        } else if (selectedType === 'stock') {
            stockField.style.display = 'block'; // 주식 필드 표시
        }
    });

    // 복합재산 총합 계산 함수
    function updateMixedTotalGiftAmount() {
        const mixedCashAmount = parseCurrency(document.getElementById('mixedCashAmount').value || '0');
        const mixedRealEstateValue = parseCurrency(document.getElementById('mixedRealEstateValue').value || '0');
        const mixedStockQuantity = parseCurrency(document.getElementById('mixedStockQuantity').value || '0');
        const mixedStockPrice = parseCurrency(document.getElementById('mixedStockPrice').value || '0');

        // 주식 총액 계산
        const mixedStockTotal = mixedStockQuantity * mixedStockPrice;

        // 총합 계산
        const mixedTotalGiftAmount = mixedCashAmount + mixedRealEstateValue + mixedStockTotal;

        // 총 금액 필드에 출력
        document.getElementById('mixedTotalAmount').value = mixedTotalGiftAmount.toLocaleString();
    }

    // 복합재산 입력 필드 이벤트 추가
    document.getElementById('mixedCashAmount').addEventListener('input', updateMixedTotalGiftAmount);
    document.getElementById('mixedRealEstateValue').addEventListener('input', updateMixedTotalGiftAmount);
    document.getElementById('mixedStockQuantity').addEventListener('input', updateMixedTotalGiftAmount);
    document.getElementById('mixedStockPrice').addEventListener('input', updateMixedTotalGiftAmount);

    // 계산 버튼 이벤트 리스너
    const calculateButton = document.getElementById('calculateButton');
    if (calculateButton) {
        calculateButton.addEventListener('click', calculateFinalTax);
    } else {
        console.error('calculateButton 요소를 찾을 수 없습니다.');
    }
});

// 관계별 공제 한도 계산
function getExemptionAmount(relationship) {
    const exemptions = {
        'adultChild': 100000000,       // 성년 자녀: 1억 원
        'minorChild': 25000000,       // 미성년 자녀: 2,500만 원
        'spouse': 700000000,          // 배우자: 7억 원
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

// 누진세 계산 함수 (청년 여부 상관없이 계산)
function calculateGiftTax(taxableAmount) {
    const taxBrackets = [
        { limit: 200000000, rate: 0.1, deduction: 0 }, // 2억 이하
        { limit: 500000000, rate: 0.2, deduction: 20000000 }, // 2억 초과 ~ 5억 이하
        { limit: 1000000000, rate: 0.3, deduction: 70000000 }, // 5억 초과 ~ 10억 이하
        { limit: 2000000000, rate: 0.4, deduction: 170000000 }, // 10억 초과 ~ 20억 이하
        { limit: Infinity, rate: 0.45, deduction: 370000000 } // 20억 초과
    ];

    let tax = 0;
    let previousLimit = 0;

    for (const bracket of taxBrackets) {
        if (taxableAmount > bracket.limit) {
            tax += (bracket.limit - previousLimit) * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            tax += (taxableAmount - previousLimit) * bracket.rate;
            tax -= bracket.deduction; // 누진 공제 적용
            break;
        }
    }

    return Math.max(tax, 0); // 음수 방지
}

// 청년 감면 적용 (누진 공제 반영)
function applyYouthReduction(originalGiftTax) {
    // 총 세금의 10%를 감면
    const reductionAmount = originalGiftTax * 0.1; // 감면액 계산
    const reducedTax = originalGiftTax - reductionAmount; // 감면 후 세금 계산

    return { reducedTax, reductionAmount };
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

// DOMContentLoaded 이벤트
// *** 결혼증여 모달 로직 ***
document.addEventListener('DOMContentLoaded', function () {
    const marriageGiftButton = document.getElementById('marriageGiftButton');
    const marriageGiftModal = document.getElementById('marriageGiftModal');
    const closeMarriageGiftModal = document.getElementById('closeMarriageGiftModal');
    const saveMarriageGiftButton = document.getElementById('saveMarriageGiftButton');

    const fatherAmountInput = document.getElementById('fatherAmountInput'); // 부 입력 필드
    const motherAmountInput = document.getElementById('motherAmountInput'); // 모 입력 필드
    const remainingAmount = document.getElementById('remainingAmount'); // 남은 금액 표시

    let remainingGiftAmount = 0; // 남은 금액 (별도 관리)

    // 모달 열기 버튼
    marriageGiftButton.addEventListener('click', function () {
        const cashInput = document.getElementById('cashAmount');
        totalGiftAmount = parseCurrency(cashInput.value || '0'); // 최초 증여 금액 유지
        remainingGiftAmount = totalGiftAmount; // 남은 금액 초기화

        if (totalGiftAmount === 0) {
            alert('증여 금액을 먼저 입력하세요.');
            return;
        }

        // 남은 금액 초기화
        remainingAmount.textContent = `${remainingGiftAmount.toLocaleString()} 원`;
        marriageGiftModal.style.display = 'block';
    });

    // 부모별 금액 입력 시 남은 금액 자동 계산
    function updateRemainingAmount() {
        const fatherAmount = parseCurrency(fatherAmountInput.value || '0');
        const motherAmount = parseCurrency(motherAmountInput.value || '0');

        // 남은 금액 계산 (totalGiftAmount는 변경하지 않음)
        remainingGiftAmount = Math.max(0, totalGiftAmount - (fatherAmount + motherAmount));
        remainingAmount.textContent = `${remainingGiftAmount.toLocaleString()} 원`;
    }

    fatherAmountInput.addEventListener('input', updateRemainingAmount);
    motherAmountInput.addEventListener('input', updateRemainingAmount);

    // 저장 버튼 클릭 (모달에서 입력값을 저장)
    saveMarriageGiftButton.addEventListener('click', function () {
        const fatherAmount = parseCurrency(fatherAmountInput.value || '0');
        const motherAmount = parseCurrency(motherAmountInput.value || '0');

        // 결혼 공제 계산 (부모 합산 최대 공제 한도)
        const marriageExemption = calculateMarriageExemption(fatherAmount, motherAmount);

        // 사용자에게 결과 알림
        alert(`결혼 공제 저장됨\n총 결혼 공제: ${marriageExemption.toLocaleString()} 원`);
        marriageGiftModal.style.display = 'none';
    });

    // 닫기 버튼 클릭 이벤트
    closeMarriageGiftModal.addEventListener('click', function () {
        marriageGiftModal.style.display = 'none';
    });

    // 계산 버튼 이벤트
    document.getElementById('calculateButton').addEventListener('click', calculateFinalTax);

    // 증여세 신고 버튼 이벤트
document.getElementById('donationTaxButton').addEventListener('click', function () {
    const giftDateContainer = document.getElementById('giftDateContainer');
    const submissionDateContainer = document.getElementById('submissionDateContainer');
    const extendedPeriodContainer = document.getElementById('extendedPeriodContainer');

    // 숨김/표시 토글
    const isVisible = giftDateContainer.style.display === 'block';
    const newDisplay = isVisible ? 'none' : 'block';

    giftDateContainer.style.display = newDisplay;
    submissionDateContainer.style.display = newDisplay;
    extendedPeriodContainer.style.display = newDisplay;
});

// 결혼 공제 계산 함수
function calculateMarriageExemption(fatherAmount, motherAmount) {
    const maxMarriageExemption = 100000000; // 부모 합산 최대 공제 한도: 1억 원
    const totalGiftAmountFromParents = fatherAmount + motherAmount;

    // 공제 최대 한도를 초과하지 않도록 제한
    return Math.min(totalGiftAmountFromParents, maxMarriageExemption);
}

// 최종 공제 계산 함수
function calculateExemptions(totalGiftAmount, relationship) {
    // 1. 관계 공제 적용
    const relationshipExemption = getExemptionAmount(relationship);

    // 2. 결혼 공제 적용
    const fatherAmount = parseCurrency(document.getElementById('fatherAmountInput').value || '0');
    const motherAmount = parseCurrency(document.getElementById('motherAmountInput').value || '0');
    const marriageExemption = calculateMarriageExemption(fatherAmount, motherAmount);

    // 3. 총 공제 합산 (증여 금액 초과 방지)
    const totalExemption = Math.min(totalGiftAmount, relationshipExemption + marriageExemption);

    return { relationshipExemption, marriageExemption, totalExemption };
}

// 최종 세금 계산 함수
function calculateFinalTax() {
    const totalGiftAmount = getGiftAmount(); // 총 증여 금액
    const relationship = document.getElementById('relationship').value;

    // 공제 계산
    const { relationshipExemption, marriageExemption, totalExemption } = calculateExemptions(totalGiftAmount, relationship);

    // 과세 금액 계산
    const taxableAmount = Math.max(0, totalGiftAmount - totalExemption);

    // 증여세 (감면 전)
    const originalGiftTax = calculateGiftTax(taxableAmount);

    // 청년 감면 여부 확인
    const isYouth = document.getElementById('isYouthDropdown').value === 'yes';
    let youthReduction = 0;
    let finalGiftTax = originalGiftTax;

    if (isYouth) {
        const reductionResult = applyYouthReduction(originalGiftTax); // 청년 감면 함수 호출
        if (reductionResult) {
            youthReduction = reductionResult.reductionAmount || 0; // 감면액 적용
            finalGiftTax = reductionResult.reducedTax || originalGiftTax; // 감면 후 세금 적용
        }
    }

    // 가산세 계산
    const giftDate = document.getElementById('giftDate').value;
    const submissionDate = document.getElementById('submissionDate').value;
    const { penalty, message } = calculateLatePenalty(submissionDate, giftDate, finalGiftTax);

    // 최종 세금 합산
    const totalTax = finalGiftTax + penalty;

    // 결과 출력
    document.getElementById('result').innerHTML = `
        <h3>최종 계산 결과</h3>
        <p>증여 금액: ${totalGiftAmount.toLocaleString()} 원</p>
        <p>관계 공제: ${relationshipExemption.toLocaleString()} 원</p>
        <p>결혼 공제: ${marriageExemption.toLocaleString()} 원</p>
        <p>총 공제 금액: ${totalExemption.toLocaleString()} 원</p>
        <p>과세 금액: ${taxableAmount.toLocaleString()} 원</p>
        <p>증여세 (감면 전): ${originalGiftTax.toLocaleString()} 원</p>
        <p>청년 증여세 감면 금액: ${youthReduction.toLocaleString()} 원</p>
        <p>증여세 (감면 후): ${finalGiftTax.toLocaleString()} 원</p>
        <p>가산세: ${penalty.toLocaleString()} 원 (${message})</p>
        <p><strong>최종 납부세액: ${(totalTax).toLocaleString()} 원</strong></p>
    `;
}

document.getElementById('calculateButton').addEventListener('click', calculateFinalTax);
                          
