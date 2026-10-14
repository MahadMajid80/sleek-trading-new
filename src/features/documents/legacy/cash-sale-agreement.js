// Ported unchanged from the legacy app (src/views/apps/user/list). These layouts are the signed legal/billing
// documents; change them deliberately. Data is supplied in the legacy shape by ../adapters.ts.

import jsPDF from 'jspdf'

// Function to convert numbers to words
const numberToWords = num => {
  if (num === 0) return 'ZERO'

  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

  const teens = [
    'TEN',
    'ELEVEN',
    'TWELVE',
    'THIRTEEN',
    'FOURTEEN',
    'FIFTEEN',
    'SIXTEEN',
    'SEVENTEEN',
    'EIGHTEEN',
    'NINETEEN'
  ]

  const convertLessThanOneThousand = num => {
    if (num === 0) return ''

    if (num < 10) return ones[num]
    if (num < 20) return teens[num - 10]
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '')
    if (num < 1000)
      return (
        ones[Math.floor(num / 100)] +
        ' HUNDRED' +
        (num % 100 !== 0 ? ' AND ' + convertLessThanOneThousand(num % 100) : '')
      )
  }

  const convert = num => {
    if (num === 0) return 'ZERO'

    const billions = Math.floor(num / 1000000000)
    const millions = Math.floor((num % 1000000000) / 1000000)
    const thousands = Math.floor((num % 1000000) / 1000)
    const remainder = num % 1000

    let result = ''

    if (billions) result += convertLessThanOneThousand(billions) + ' BILLION '
    if (millions) result += convertLessThanOneThousand(millions) + ' MILLION '
    if (thousands) result += convertLessThanOneThousand(thousands) + ' THOUSAND '
    if (remainder) result += convertLessThanOneThousand(remainder)

    return result.trim()
  }

  return convert(Math.floor(num)) + ' ONLY'
}

// Function to get day suffix (1st, 2nd, 3rd, etc.)
const getDaySuffix = day => {
  if (day >= 11 && day <= 13) {
    return 'TH'
  }

  switch (day % 10) {
    case 1:
      return 'ST'
    case 2:
      return 'ND'
    case 3:
      return 'RD'
    default:
      return 'TH'
  }
}

export const generateAgreementPDF = agreementData => {
  const doc = new jsPDF()
  let y = 30 // Starting position - increased for better header spacing

  // Define content boundaries
  const leftMargin = 10
  const rightMargin = 200 // A4 width is 210, so 200 gives 10px margin
  const contentWidth = rightMargin - leftMargin

  // Function to wrap text to a specific width
  const wrapText = (text, maxWidth, x, y, lineHeight = 6) => {
    const words = text.split(' ')
    let line = ''
    let currentY = y

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' '
      const testWidth = doc.getTextWidth(testLine)

      if (testWidth > maxWidth && line !== '') {
        doc.text(line, x, currentY)
        line = words[i] + ' '
        currentY += lineHeight
      } else {
        line = testLine
      }
    }

    if (line) {
      doc.text(line, x, currentY)
    }

    return currentY + lineHeight // Return the next Y position
  }

  // Header
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('CAR SALE AGREEMENT', 105, y, { align: 'center' })
  y += 8
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  doc.text(`NAME OF BUYER: ${agreementData.user?.name || ''}`, 10, y)

  // Build motor name with fallback logic
  let motorName = ''

  if (agreementData.car?.makeLabel && agreementData.car.makeLabel !== 'Unknown Make') {
    motorName = agreementData.car.makeLabel
  } else if (agreementData.car?.brandName && agreementData.car?.carName) {
    motorName = `${agreementData.car.brandName} ${agreementData.car.carName}`
  } else if (agreementData.car?.makeName) {
    motorName = agreementData.car.makeName
  } else {
    motorName = 'Unknown Make'
  }

  doc.text(`MOTOR: ${motorName}`, 120, y)
  y += 5
  doc.text(`ID: ${agreementData.user?.id || ''}`, 10, y)
  doc.text(`CHASIS NO: ${agreementData.car?.chesisNo || ''}`, 120, y)
  y += 5
  doc.text(`KRA PIN: ${agreementData.user?.kraNo || ''}`, 10, y)
  doc.text(`ENG NO: ${agreementData.car?.engNo || ''}`, 120, y)
  y += 5
  doc.text(`P.O.BOX: ${agreementData.user?.poBox || ''}`, 10, y)
  doc.text(`REG NO: ${agreementData.car?.regNo || ''}`, 120, y)
  y += 5
  doc.text(`TEL NO: ${agreementData.user?.telephone || ''}`, 10, y)
  doc.text(`MODEL: ${agreementData.car?.model || ''}`, 120, y)
  y += 5
  doc.text(`COLOUR: ${agreementData.car?.color || ''}`, 10, y)
  doc.text(`CC: ${agreementData.car?.cc || ''}`, 120, y)
  y += 8

  // Financials
  doc.setFont('times', 'bold')
  const agreedPrice = agreementData.agreedPrice || 0
  const deposit = agreementData.deposit || 0
  const balance = agreementData.balance || 0

  const agreedPriceText = `AGREED PRICE: KSHS. ${agreedPrice.toLocaleString()} (${numberToWords(agreedPrice)})`

  doc.text('AGREED PRICE:', 10, y)
  const agreedPriceLabelWidth = doc.getTextWidth('AGREED PRICE:')

  doc.line(10, y + 1, 10 + agreedPriceLabelWidth, y + 1) // Underline only "AGREED PRICE:"
  const agreedPriceValue = `KSHS. ${agreedPrice.toLocaleString()} (${numberToWords(agreedPrice)})`

  // Start value text closer to the heading (just after the colon)
  y = wrapText(agreedPriceValue, contentWidth - (10 + agreedPriceLabelWidth + 2), 10 + agreedPriceLabelWidth + 2, y)
  y += 2

  const depositText = `DEPOSIT: KSHS. ${deposit.toLocaleString()} (${numberToWords(deposit)})`

  doc.text('DEPOSIT:', 10, y)
  const depositLabelWidth = doc.getTextWidth('DEPOSIT:')

  doc.line(10, y + 1, 10 + depositLabelWidth, y + 1) // Underline only "DEPOSIT:"
  const depositValue = `KSHS. ${deposit.toLocaleString()} (${numberToWords(deposit)})`

  // Start value text closer to the heading (just after the colon)
  y = wrapText(depositValue, contentWidth - (10 + depositLabelWidth + 2), 10 + depositLabelWidth + 2, y)
  y += 2

  // Add "Paid as Vehicle" section if trade-in is selected (moved here after deposit)
  // Handle both new array format and old single car format (backward compatibility)
  const tradeInCars =
    agreementData.cashTradeInCars &&
    Array.isArray(agreementData.cashTradeInCars) &&
    agreementData.cashTradeInCars.length > 0
      ? agreementData.cashTradeInCars
      : agreementData.cashTradeInCar
        ? [{ ...agreementData.cashTradeInCar, amount: agreementData.cashTradeInCarAmount || 0 }]
        : []

  if (agreementData.cashTradeIn === 'yes' && tradeInCars.length > 0) {
    tradeInCars.forEach((tradeInCar, carIndex) => {
      const paidAsVehicleLabel = carIndex === 0 ? 'PAID AS VEHICLE:' : ''

      // Build the complete car details in a single row format with robust fallback logic
      let carMakeModel = ''

      if (tradeInCar.brandName && tradeInCar.carName) {
        carMakeModel = `${tradeInCar.brandName} ${tradeInCar.carName}`
      } else if (tradeInCar.makeLabel && tradeInCar.makeLabel !== 'Unknown Make') {
        carMakeModel = tradeInCar.makeLabel
      } else if (tradeInCar.brandName) {
        carMakeModel = tradeInCar.brandName
      } else if (tradeInCar.carName) {
        carMakeModel = tradeInCar.carName
      } else if (tradeInCar.label) {
        carMakeModel = tradeInCar.label
      }

      const carDetails = []

      if (tradeInCar.chesisNo) {
        carDetails.push(`CHASIS: ${tradeInCar.chesisNo}`)
      }

      if (tradeInCar.engNo) {
        carDetails.push(`ENG: ${tradeInCar.engNo}`)
      }

      // REG NO removed as per requirement

      // Combine car make/model with details
      const carDetailsText = carDetails.length > 0 ? ` ${carDetails.join(' ')}` : ''

      if (paidAsVehicleLabel) {
        doc.text(paidAsVehicleLabel, 10, y)

        // Underline only the text itself
        const paidAsVehicleLabelWidth = doc.getTextWidth(paidAsVehicleLabel)

        doc.line(10, y + 1, 10 + paidAsVehicleLabelWidth, y + 1)
        y += 5 // Move down after the heading and underline
      }

      // Combine car details and amount in one line with numbering
      const carNumber = `${carIndex + 1}. `
      let combinedText = carNumber + carMakeModel + carDetailsText

      if (tradeInCar.amount) {
        const vehicleAmount = Number(tradeInCar.amount) || 0

        combinedText += ` AMOUNT: KSHS. ${vehicleAmount.toLocaleString()}`
      }

      // Start all lines from the same position as "PAID AS VEHICLE:" (leftMargin = 10)
      y = wrapText(combinedText, contentWidth, leftMargin, y)
      y += 2
    })

    // Add remaining deposit amount if deposit and trade-in cars are provided
    if (agreementData.deposit && tradeInCars.length > 0) {
      const deposit = Number(agreementData.deposit) || 0
      const totalTradeInAmount = tradeInCars.reduce((sum, car) => sum + Number(car.amount || 0), 0)
      const remainingDeposit = deposit - totalTradeInAmount

      // Only show remaining deposit section if amount is greater than zero
      if (remainingDeposit > 0) {
        doc.setFont('times', 'bold')
        doc.setFontSize(10)
        const remainingDepositLabel = 'REMAINING DEPOSIT AMOUNT:'
        const paymentMethod = agreementData.remainingDepositPaymentMethod || ''

        doc.text(remainingDepositLabel, 10, y)
        const remainingDepositLabelWidth = doc.getTextWidth(remainingDepositLabel)

        doc.line(10, y + 1, 10 + remainingDepositLabelWidth, y + 1)

        // Start value text closer to the heading (just after the colon)
        const remainingDepositValue = `KSHS. ${remainingDeposit.toLocaleString()} (${numberToWords(remainingDeposit)})${paymentMethod ? ` PAID AS ${paymentMethod.toUpperCase()}` : ''}`

        y = wrapText(
          remainingDepositValue,
          contentWidth - (10 + remainingDepositLabelWidth + 2),
          10 + remainingDepositLabelWidth + 2,
          y
        )
        y += 2
      }
    }
  }

  const balanceText = `BALANCE: KSHS. ${balance.toLocaleString()} (${numberToWords(balance)}) TO BE PAID AFTER SELLING THE VEHICLE.`

  doc.text('BALANCE:', 10, y)
  const balanceLabelWidth = doc.getTextWidth('BALANCE:')

  doc.line(10, y + 1, 10 + balanceLabelWidth, y + 1) // Underline only "BALANCE:"

  const balanceValue =
    balance > 0
      ? `KSHS. ${balance.toLocaleString()} (${numberToWords(balance)}) TO BE PAID AFTER SELLING THE VEHICLE.`
      : `KSHS. ${balance.toLocaleString()} (${numberToWords(balance)})`

  // Start value text closer to the heading (just after the colon)
  y = wrapText(balanceValue, contentWidth - (10 + balanceLabelWidth + 2), 10 + balanceLabelWidth + 2, y)
  y += 2
  doc.setFont('times', 'normal')

  // Debug: Log checkbox values
  console.log('Cash Sale Agreement PDF - Checkbox values:', {
    physicalLogbook: agreementData.physicalLogbook,
    transferLogbook: agreementData.transferLogbook,
    uponPayment: agreementData.uponPayment
  })

  // Draw first checkbox before PHYSICAL LOGBOOK
  const checkbox1X = 10
  const checkbox1Y = y - 3

  doc.rect(checkbox1X, checkbox1Y, 4, 4, 'S') // Small square

  if (agreementData.physicalLogbook === true || agreementData.physicalLogbook === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox1X + 0.5, checkbox1Y + 2, checkbox1X + 1.5, checkbox1Y + 3.5) // First line of check
    doc.line(checkbox1X + 1.5, checkbox1Y + 3.5, checkbox1X + 3.5, checkbox1Y + 0.5) // Second line of check
  }

  doc.text('PHYSICAL LOGBOOK', 20, y)

  // Draw second checkbox before TRANSFER LOGBOOK
  const checkbox2X = 60
  const checkbox2Y = y - 3

  doc.rect(checkbox2X, checkbox2Y, 4, 4, 'S') // Small square

  if (agreementData.transferLogbook === true || agreementData.transferLogbook === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox2X + 0.5, checkbox2Y + 2, checkbox2X + 1.5, checkbox2Y + 3.5) // First line of check
    doc.line(checkbox2X + 1.5, checkbox2Y + 3.5, checkbox2X + 3.5, checkbox2Y + 0.5) // Second line of check
  }

  doc.text('TRANSFER LOGBOOK', 70, y)

  // Draw third checkbox before UPON PAYMENT
  const checkbox3X = 110
  const checkbox3Y = y - 3

  doc.rect(checkbox3X, checkbox3Y, 4, 4, 'S') // Small square

  if (agreementData.uponPayment === true || agreementData.uponPayment === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox3X + 0.5, checkbox3Y + 2, checkbox3X + 1.5, checkbox3Y + 3.5) // First line of check
    doc.line(checkbox3X + 1.5, checkbox3Y + 3.5, checkbox3X + 3.5, checkbox3Y + 0.5) // Second line of check
  }

  doc.text('UPON PAYMENT.', 120, y)
  y += 8
  doc.setFont('times', 'bold')
  const agreementText = 'IT IS FURTHER AGREED BETWEEN THE BUYER AND THE SELLER AS FOLLOWS:'

  doc.text(agreementText, 10, y)
  const agreementWidth = doc.getTextWidth(agreementText)

  doc.line(10, y + 1, 10 + agreementWidth, y + 1) // Underline only the text
  y += 8

  // Clauses (user provided, with bluettes and proper wrapping)
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  if (doc.setCharSpace) doc.setCharSpace(0)

  const clauses = [
    'The aforesaid motor vehicle is sold on basis "AS IT IS" and the seller does not give any guarantee whatsoever to the buyer.',
    'The buyer has confirmed by signing this agreement that he/she has taken possession of a fore said motor vehicle on the basis of "AS IT IS" and upon being satisfied that the motor vehicle is in a proper condition.',
    'Immediately the buyer takes possession of the motor vehicle, he/she shall be responsible to cater for Insurance cover at an insurance company of his or her choice, road license, etc.',
    'The log book together with the duly transfer form shall be handed over to the buyer.',
    "It's the responsibility of the customer to pay for the change of the ownership of the above vehicle as soon as possible.",
    'Any claims, offenses Etc. arising from the use of the vehicle from the date of delivery shall be the sole responsibility of the purchaser and vendor shall not in any way be liable for the same.',
    'Client is required to provide payment confirmation for verification to facilitate the transfer process at the point of transfer.',
    'Client is required to provide payment confirmation for verification to facilitate the transfer process for transfer.'
  ]

  const bulletX = 12
  const textX = bulletX + 4 // indent for text after bullet
  const maxWidth = 190 - textX // increased width to use more space

  clauses.forEach(clause => {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    if (doc.setCharSpace) doc.setCharSpace(0)

    // Split the clause into lines that fit the page
    const lines = doc.splitTextToSize(clause, maxWidth)

    // Draw the first line with the bullet
    doc.text(`•`, bulletX, y)
    doc.text(lines[0], textX, y)

    // Draw any wrapped lines, indented
    for (let i = 1; i < lines.length; i++) {
      y += 3
      doc.text(lines[i], textX, y)
    }

    y += 4
  })
  y += 6

  // Witnessing clause with agreement creation date
  y += 3
  doc.setFont('times', 'bold')
  doc.setFontSize(10)

  // Get agreement creation date in the required format
  const agreementDate = agreementData.createdAt ? new Date(agreementData.createdAt) : new Date()
  const day = agreementDate.getDate()
  const daySuffix = getDaySuffix(day)
  const dayName = agreementDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const monthName = agreementDate.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const year = agreementDate.getFullYear()
  const yearInWords = numberToWords(year)

  const witnessingText = `IN WITNESS WHEREOF THE PARTIES HAVE SET THEIR HANDS THIS ${day}${daySuffix} DAY OF ${dayName} ${monthName} ${yearInWords.toUpperCase()}.`

  const witnessingLines = doc.splitTextToSize(witnessingText, contentWidth)

  witnessingLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += witnessingLines.length * 4 + 8

  // Signatures and Payment Details with text wrapping
  doc.setFont('times', 'bold')
  const buyerSignature = 'SIGNED BY THE SAID BUYER'
  const buyerSigLines = doc.splitTextToSize(buyerSignature, contentWidth)

  buyerSigLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += buyerSigLines.length * 4 + 12 // Increased spacing for better layout

  // Second row: Seller, Witness, and Next of Kin in a row
  const sellerSig = 'SIGNED BY THE SAID SELLER'
  const witnessSig = 'SIGNED BY THE SAID WITNESS'
  const nextOfKinSig = 'NEXT OF KIN DETAILS'

  const sellerLines = doc.splitTextToSize(sellerSig, contentWidth / 3 - 5)
  const witnessLines = doc.splitTextToSize(witnessSig, contentWidth / 3 - 5)
  const nextOfKinLines = doc.splitTextToSize(nextOfKinSig, contentWidth / 3 - 5)

  sellerLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  witnessLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 5, y + index * 4)
  })
  nextOfKinLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 10, y + index * 4)
  })

  const signatureHeadingsY = y
  const signatureDetailsGap = 10
  const nextOfKinDetailsGap = 2

  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Seller details (left column) with text wrapping
  const sellerName = `NAME: ${agreementData.seller?.name || ''}`
  const sellerId = `ID NO: ${agreementData.seller?.id || ''}`
  const sellerKra = `KRA PIN: ${agreementData.seller?.kraNo || ''}`
  const sellerTel = `TEL NO: ${agreementData.seller?.telephone || ''}`

  const sellerNameLines = doc.splitTextToSize(sellerName, contentWidth / 3 - 5)
  const sellerIdLines = doc.splitTextToSize(sellerId, contentWidth / 3 - 5)
  const sellerKraLines = doc.splitTextToSize(sellerKra, contentWidth / 3 - 5)
  const sellerTelLines = doc.splitTextToSize(sellerTel, contentWidth / 3 - 5)

  y = signatureHeadingsY + sellerLines.length * 4 + signatureDetailsGap

  sellerNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerNameLines.length * 4

  sellerIdLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerIdLines.length * 4

  sellerKraLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerKraLines.length * 4

  sellerTelLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerTelLines.length * 4

  const sellerEndY = y

  // Witness details (middle column) with text wrapping
  y = signatureHeadingsY + witnessLines.length * 4 + signatureDetailsGap
  const witnessName = `NAME: ${agreementData.witness?.name || ''}`
  const witnessId = `ID NO: ${agreementData.witness?.id || ''}`
  const witnessTel = `TEL NO: ${agreementData.witness?.telephone || ''}`

  const witnessNameLines = doc.splitTextToSize(witnessName, contentWidth / 3 - 5)
  const witnessIdLines = doc.splitTextToSize(witnessId, contentWidth / 3 - 5)
  const witnessTelLines = doc.splitTextToSize(witnessTel, contentWidth / 3 - 5)

  witnessNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 7, y + index * 4)
  })
  y += witnessNameLines.length * 4

  witnessIdLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 7, y + index * 4)
  })
  y += witnessIdLines.length * 4

  witnessTelLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 7, y + index * 4)
  })
  y += witnessTelLines.length * 4

  const witnessEndY = y

  // Next of Kin details (right column) with text wrapping
  y = signatureHeadingsY + nextOfKinLines.length * 4 + nextOfKinDetailsGap
  const nextOfKinName = `NAME: ${agreementData.nextOfKin?.name || ''}`
  const nextOfKinId = `ID NO: ${agreementData.nextOfKin?.id || ''}`
  const nextOfKinKra = `KRA PIN: ${agreementData.nextOfKin?.kraNo || ''}`
  const nextOfKinTel = `TEL NO: ${agreementData.nextOfKin?.telephone || ''}`

  const nextOfKinNameLines = doc.splitTextToSize(nextOfKinName, contentWidth / 3 - 5)
  const nextOfKinIdLines = doc.splitTextToSize(nextOfKinId, contentWidth / 3 - 5)
  const nextOfKinKraLines = doc.splitTextToSize(nextOfKinKra, contentWidth / 3 - 5)
  const nextOfKinTelLines = doc.splitTextToSize(nextOfKinTel, contentWidth / 3 - 5)

  nextOfKinNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 12, y + index * 4)
  })
  y += nextOfKinNameLines.length * 4

  nextOfKinIdLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 12, y + index * 4)
  })
  y += nextOfKinIdLines.length * 4

  nextOfKinKraLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 12, y + index * 4)
  })
  y += nextOfKinKraLines.length * 4

  nextOfKinTelLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 12, y + index * 4)
  })
  y += nextOfKinTelLines.length * 4
  y = Math.max(sellerEndY, witnessEndY, y)

  // Add Payment Details below the witness section
  y += 8 // Increased space before payment details

  doc.setFont('times', 'bold')
  const paymentDetails = 'PAYMENT DETAILS'
  const paymentLines = doc.splitTextToSize(paymentDetails, contentWidth)

  paymentLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })

  const paymentDetailsWidth = doc.getTextWidth(paymentLines[0])

  doc.line(leftMargin, y + 1, leftMargin + paymentDetailsWidth, y + 1)
  y += paymentLines.length * 4 + 2

  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Payment details with text wrapping - Single column format like Next of Kin
  const accountName = `ACCOUNT NAME: ${agreementData.account?.accountTitle || ''}`
  const accountNo = `ACCOUNT NO: ${agreementData.account?.accountNumber || ''}`
  const bankName = `BANK: ${agreementData.account?.bankName || ''}`
  const branchName = `BRANCH: ${agreementData.account?.branchName || ''}`
  const paybill = `PAYBILL: ${agreementData.paybill || ''}`

  const accountNameLines = doc.splitTextToSize(accountName, contentWidth)
  const accountNoLines = doc.splitTextToSize(accountNo, contentWidth)
  const bankNameLines = doc.splitTextToSize(bankName, contentWidth)
  const branchNameLines = doc.splitTextToSize(branchName, contentWidth)
  const paybillLines = doc.splitTextToSize(paybill, contentWidth)

  // Single column format - all fields aligned vertically
  accountNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNameLines.length * 4 // Removed extra spacing after account name

  accountNoLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNoLines.length * 4 // Removed extra spacing after account number

  bankNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += bankNameLines.length * 4 // Removed extra spacing after bank name

  branchNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += branchNameLines.length * 4

  // Add Paybill field below the account details
  paybillLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += paybillLines.length * 4

  // Generate filename with buyer name, agreement type, and id
  let filename = ''

  // Add buyer name first if available
  if (agreementData.user?.name) {
    filename += agreementData.user.name.replace(/[^a-zA-Z0-9]/g, '-')
  }

  // Add agreement type
  filename += filename ? '-cash-sale-agreement' : 'cash-sale-agreement'

  // Add ID
  const agreementId = agreementData.slkId || agreementData.id || ''

  if (agreementId) {
    filename += `-${agreementId}`
  }

  // Clean up filename and add .pdf extension
  filename = filename.replace(/--+/g, '-').replace(/^-|-$/g, '') + '.pdf'

  doc.save(filename)
}

// Modified version that can return PDF data for emails
export const generateAgreementPDFForEmail = agreementData => {
  // Call the original function logic but return data instead of downloading
  const doc = new jsPDF()
  let y = 25 // Starting position

  // Debug: Log the agreement data to see what we're working with

  // Define content boundaries
  const leftMargin = 10
  const rightMargin = 200
  const contentWidth = rightMargin - leftMargin

  // Function to wrap text to a specific width
  const wrapText = (text, maxWidth, x, y, lineHeight = 6) => {
    const words = text.split(' ')
    let line = ''
    let currentY = y

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' '
      const testWidth = doc.getTextWidth(testLine)

      if (testWidth > maxWidth && line !== '') {
        doc.text(line, x, currentY)
        line = words[i] + ' '
        currentY += lineHeight
      } else {
        line = testLine
      }
    }

    if (line) {
      doc.text(line, x, currentY)
    }

    return currentY + lineHeight
  }

  // Header
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('CAR SALE AGREEMENT', 105, y, { align: 'center' })
  y += 8
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  doc.text(`NAME OF BUYER: ${agreementData.user?.name || ''}`, 10, y)

  // Build motor name with fallback logic
  let motorName = ''

  if (agreementData.car?.makeLabel && agreementData.car.makeLabel !== 'Unknown Make') {
    motorName = agreementData.car.makeLabel
  } else if (agreementData.car?.brandName && agreementData.car?.carName) {
    motorName = `${agreementData.car.brandName} ${agreementData.car.carName}`
  } else if (agreementData.car?.makeName) {
    motorName = agreementData.car.makeName
  } else {
    motorName = 'Unknown Make'
  }

  doc.text(`MOTOR: ${motorName}`, 120, y)
  y += 5
  doc.text(`ID: ${agreementData.user?.id || ''}`, 10, y)
  doc.text(`CHASIS NO: ${agreementData.car?.chesisNo || ''}`, 120, y)
  y += 5
  doc.text(`KRA PIN: ${agreementData.user?.kraNo || ''}`, 10, y)
  doc.text(`ENG NO: ${agreementData.car?.engNo || ''}`, 120, y)
  y += 5
  doc.text(`P.O.BOX: ${agreementData.user?.poBox || ''}`, 10, y)
  doc.text(`REG NO: ${agreementData.car?.regNo || ''}`, 120, y)
  y += 5
  doc.text(`TEL NO: ${agreementData.user?.telephone || ''}`, 10, y)
  doc.text(`MODEL: ${agreementData.car?.model || ''}`, 120, y)
  y += 5
  doc.text(`COLOUR: ${agreementData.car?.color || ''}`, 10, y)
  doc.text(`CC: ${agreementData.car?.cc || ''}`, 120, y)
  y += 8

  // Add all the content from the original function
  // Financials
  doc.setFont('times', 'bold')
  const agreedPrice = agreementData.agreedPrice || 0
  const deposit = agreementData.deposit || 0
  const balance = agreementData.balance || 0


  const agreedPriceText = `AGREED PRICE: KSHS. ${agreedPrice.toLocaleString()} (${numberToWords(agreedPrice)})`

  doc.text('AGREED PRICE:', 10, y)
  const agreedPriceLabelWidth = doc.getTextWidth('AGREED PRICE:')

  doc.line(10, y + 1, 10 + agreedPriceLabelWidth, y + 1) // Underline only "AGREED PRICE:"
  const agreedPriceValue = `KSHS. ${agreedPrice.toLocaleString()} (${numberToWords(agreedPrice)})`

  // Start value text closer to the heading (just after the colon)
  y = wrapText(agreedPriceValue, contentWidth - (10 + agreedPriceLabelWidth + 2), 10 + agreedPriceLabelWidth + 2, y)
  y += 2

  const depositText = `DEPOSIT: KSHS. ${deposit.toLocaleString()} (${numberToWords(deposit)})`

  doc.text('DEPOSIT:', 10, y)
  const depositLabelWidth = doc.getTextWidth('DEPOSIT:')

  doc.line(10, y + 1, 10 + depositLabelWidth, y + 1) // Underline only "DEPOSIT:"
  const depositValue = `KSHS. ${deposit.toLocaleString()} (${numberToWords(deposit)})`

  // Start value text closer to the heading (just after the colon)
  y = wrapText(depositValue, contentWidth - (10 + depositLabelWidth + 2), 10 + depositLabelWidth + 2, y)
  y += 2

  // Add "Paid as Vehicle" section if trade-in is selected (moved here after deposit)
  // Handle both new array format and old single car format (backward compatibility)
  const tradeInCars =
    agreementData.cashTradeInCars &&
    Array.isArray(agreementData.cashTradeInCars) &&
    agreementData.cashTradeInCars.length > 0
      ? agreementData.cashTradeInCars
      : agreementData.cashTradeInCar
        ? [{ ...agreementData.cashTradeInCar, amount: agreementData.cashTradeInCarAmount || 0 }]
        : []

  if (agreementData.cashTradeIn === 'yes' && tradeInCars.length > 0) {
    tradeInCars.forEach((tradeInCar, carIndex) => {
      const paidAsVehicleLabel = carIndex === 0 ? 'PAID AS VEHICLE:' : ''

      // Build the complete car details in a single row format with robust fallback logic
      let carMakeModel = ''

      if (tradeInCar.brandName && tradeInCar.carName) {
        carMakeModel = `${tradeInCar.brandName} ${tradeInCar.carName}`
      } else if (tradeInCar.makeLabel && tradeInCar.makeLabel !== 'Unknown Make') {
        carMakeModel = tradeInCar.makeLabel
      } else if (tradeInCar.brandName) {
        carMakeModel = tradeInCar.brandName
      } else if (tradeInCar.carName) {
        carMakeModel = tradeInCar.carName
      } else if (tradeInCar.label) {
        carMakeModel = tradeInCar.label
      }

      const carDetails = []

      if (tradeInCar.chesisNo) {
        carDetails.push(`CHASIS: ${tradeInCar.chesisNo}`)
      }

      if (tradeInCar.engNo) {
        carDetails.push(`ENG: ${tradeInCar.engNo}`)
      }

      // REG NO removed as per requirement

      // Combine car make/model with details
      const carDetailsText = carDetails.length > 0 ? ` ${carDetails.join(' ')}` : ''

      if (paidAsVehicleLabel) {
        doc.text(paidAsVehicleLabel, 10, y)

        // Underline only the text itself
        const paidAsVehicleLabelWidth = doc.getTextWidth(paidAsVehicleLabel)

        doc.line(10, y + 1, 10 + paidAsVehicleLabelWidth, y + 1)
        y += 5 // Move down after the heading and underline
      }

      // Combine car details and amount in one line with numbering
      const carNumber = `${carIndex + 1}. `
      let combinedText = carNumber + carMakeModel + carDetailsText

      if (tradeInCar.amount) {
        const vehicleAmount = Number(tradeInCar.amount) || 0

        combinedText += ` AMOUNT: KSHS. ${vehicleAmount.toLocaleString()}`
      }

      // Start all lines from the same position as "PAID AS VEHICLE:" (leftMargin = 10)
      y = wrapText(combinedText, contentWidth, leftMargin, y)
      y += 2
    })

    // Add remaining deposit amount if deposit and trade-in cars are provided
    if (agreementData.deposit && tradeInCars.length > 0) {
      const deposit = Number(agreementData.deposit) || 0
      const totalTradeInAmount = tradeInCars.reduce((sum, car) => sum + Number(car.amount || 0), 0)
      const remainingDeposit = deposit - totalTradeInAmount

      // Only show remaining deposit section if amount is greater than zero
      if (remainingDeposit > 0) {
        doc.setFont('times', 'bold')
        doc.setFontSize(10)
        const remainingDepositLabel = 'REMAINING DEPOSIT AMOUNT:'
        const paymentMethod = agreementData.remainingDepositPaymentMethod || ''

        doc.text(remainingDepositLabel, 10, y)
        const remainingDepositLabelWidth = doc.getTextWidth(remainingDepositLabel)

        doc.line(10, y + 1, 10 + remainingDepositLabelWidth, y + 1)

        // Start value text closer to the heading (just after the colon)
        const remainingDepositValue = `KSHS. ${remainingDeposit.toLocaleString()} (${numberToWords(remainingDeposit)})${paymentMethod ? ` PAID AS ${paymentMethod.toUpperCase()}` : ''}`

        y = wrapText(
          remainingDepositValue,
          contentWidth - (10 + remainingDepositLabelWidth + 2),
          10 + remainingDepositLabelWidth + 2,
          y
        )
        y += 2
      }
    }
  }

  const balanceText = `BALANCE: KSHS. ${balance.toLocaleString()} (${numberToWords(balance)}) TO BE PAID AFTER SELLING THE VEHICLE.`

  doc.text('BALANCE:', 10, y)
  const balanceLabelWidth = doc.getTextWidth('BALANCE:')

  doc.line(10, y + 1, 10 + balanceLabelWidth, y + 1) // Underline only "BALANCE:"

  const balanceValue =
    balance > 0
      ? `KSHS. ${balance.toLocaleString()} (${numberToWords(balance)}) TO BE PAID AFTER SELLING THE VEHICLE.`
      : `KSHS. ${balance.toLocaleString()} (${numberToWords(balance)})`

  y = wrapText(balanceValue, 120, 55, y)
  y += 3
  doc.setFont('times', 'normal')

  // Debug: Log checkbox values
  console.log('Cash Sale Agreement PDF - Checkbox values:', {
    physicalLogbook: agreementData.physicalLogbook,
    transferLogbook: agreementData.transferLogbook,
    uponPayment: agreementData.uponPayment
  })

  // Draw first checkbox before PHYSICAL LOGBOOK
  const checkbox1X = 10
  const checkbox1Y = y - 3

  doc.rect(checkbox1X, checkbox1Y, 4, 4, 'S') // Small square

  if (agreementData.physicalLogbook === true || agreementData.physicalLogbook === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox1X + 0.5, checkbox1Y + 2, checkbox1X + 1.5, checkbox1Y + 3.5) // First line of check
    doc.line(checkbox1X + 1.5, checkbox1Y + 3.5, checkbox1X + 3.5, checkbox1Y + 0.5) // Second line of check
  }

  doc.text('PHYSICAL LOGBOOK', 20, y)

  // Draw second checkbox before TRANSFER LOGBOOK
  const checkbox2X = 60
  const checkbox2Y = y - 3

  doc.rect(checkbox2X, checkbox2Y, 4, 4, 'S') // Small square

  if (agreementData.transferLogbook === true || agreementData.transferLogbook === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox2X + 0.5, checkbox2Y + 2, checkbox2X + 1.5, checkbox2Y + 3.5) // First line of check
    doc.line(checkbox2X + 1.5, checkbox2Y + 3.5, checkbox2X + 3.5, checkbox2Y + 0.5) // Second line of check
  }

  doc.text('TRANSFER LOGBOOK', 70, y)

  // Draw third checkbox before UPON PAYMENT
  const checkbox3X = 110
  const checkbox3Y = y - 3

  doc.rect(checkbox3X, checkbox3Y, 4, 4, 'S') // Small square

  if (agreementData.uponPayment === true || agreementData.uponPayment === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox3X + 0.5, checkbox3Y + 2, checkbox3X + 1.5, checkbox3Y + 3.5) // First line of check
    doc.line(checkbox3X + 1.5, checkbox3Y + 3.5, checkbox3X + 3.5, checkbox3Y + 0.5) // Second line of check
  }

  doc.text('UPON PAYMENT.', 120, y)
  y += 8
  doc.setFont('times', 'bold')
  const agreementText = 'IT IS FURTHER AGREED BETWEEN THE BUYER AND THE SELLER AS FOLLOWS:'

  doc.text(agreementText, 10, y)
  const agreementWidth = doc.getTextWidth(agreementText)

  doc.line(10, y + 1, 10 + agreementWidth, y + 1) // Underline only the text
  y += 8

  // Clauses (user provided, with bluettes and proper wrapping)
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  if (doc.setCharSpace) doc.setCharSpace(0)

  const clauses = [
    'The aforesaid motor vehicle is sold on basis "AS IT IS" and the seller does not give any guarantee whatsoever to the buyer.',
    'The buyer has confirmed by signing this agreement that he/she has taken possession of a fore said motor vehicle on the basis of "AS IT IS" and upon being satisfied that the motor vehicle is in a proper condition.',
    'Immediately the buyer takes possession of the motor vehicle, he/she shall be responsible to cater for Insurance cover at an insurance company of his or her choice, road license, etc.',
    'The log book together with the duly transfer form shall be handed over to the buyer.',
    "It's the responsibility of the customer to pay for the change of the ownership of the above vehicle as soon as possible.",
    'Any claims, offenses Etc. arising from the use of the vehicle from the date of delivery shall be the sole responsibility of the purchaser and vendor shall not in any way be liable for the same.',
    'Client is required to provide payment confirmation for verification to facilitate the transfer process at the point of transfer.',
    'Client is required to provide payment confirmation for verification to facilitate the transfer process for transfer.'
  ]

  const bulletX = 12
  const textX = bulletX + 4 // indent for text after bullet
  const maxWidth = 190 - textX // increased width to use more space

  clauses.forEach(clause => {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    if (doc.setCharSpace) doc.setCharSpace(0)

    // Split the clause into lines that fit the page
    const lines = doc.splitTextToSize(clause, maxWidth)

    // Draw the first line with the bullet
    doc.text(`•`, bulletX, y)
    doc.text(lines[0], textX, y)

    // Draw any wrapped lines, indented
    for (let i = 1; i < lines.length; i++) {
      y += 3
      doc.text(lines[i], textX, y)
    }

    y += 4
  })

  // Witnessing clause with agreement creation date
  y += 3
  doc.setFont('times', 'bold')
  doc.setFontSize(10)

  // Get agreement creation date in the required format
  const agreementDate = agreementData.createdAt ? new Date(agreementData.createdAt) : new Date()
  const day = agreementDate.getDate()
  const daySuffix = getDaySuffix(day)
  const dayName = agreementDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const monthName = agreementDate.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const year = agreementDate.getFullYear()
  const yearInWords = numberToWords(year)

  const witnessingText = `IN WITNESS WHEREOF THE PARTIES HAVE SET THEIR HANDS THIS ${day}${daySuffix} DAY OF ${dayName} ${monthName} ${yearInWords.toUpperCase()}.`

  const witnessingLines = doc.splitTextToSize(witnessingText, contentWidth)

  witnessingLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += witnessingLines.length * 4 + 8

  // Add witness, seller, and next of kin sections - EXACT same layout as original
  doc.setFont('times', 'bold')
  const buyerSignature = 'SIGNED BY THE SAID BUYER'
  const buyerSigLines = doc.splitTextToSize(buyerSignature, contentWidth)

  buyerSigLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += buyerSigLines.length * 4 + 12 // Increased spacing for better layout

  // Second row: Seller, Witness, and Next of Kin in a row
  const sellerSig = 'SIGNED BY THE SAID SELLER'
  const witnessSig = 'SIGNED BY THE SAID WITNESS'
  const nextOfKinSig = 'NEXT OF KIN DETAILS'

  const sellerLines = doc.splitTextToSize(sellerSig, contentWidth / 3 - 5)
  const witnessLines = doc.splitTextToSize(witnessSig, contentWidth / 3 - 5)
  const nextOfKinLines = doc.splitTextToSize(nextOfKinSig, contentWidth / 3 - 5)

  sellerLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  witnessLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 5, y + index * 4)
  })
  nextOfKinLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 10, y + index * 4)
  })

  const signatureHeadingsY = y
  const signatureDetailsGap = 10
  const nextOfKinDetailsGap = 2

  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Seller details (left column) with text wrapping
  const sellerName = `NAME: ${agreementData.seller?.name || ''}`
  const sellerId = `ID NO: ${agreementData.seller?.id || ''}`
  const sellerKra = `KRA PIN: ${agreementData.seller?.kraNo || ''}`
  const sellerTel = `TEL NO: ${agreementData.seller?.telephone || ''}`

  const sellerNameLines = doc.splitTextToSize(sellerName, contentWidth / 3 - 5)
  const sellerIdLines = doc.splitTextToSize(sellerId, contentWidth / 3 - 5)
  const sellerKraLines = doc.splitTextToSize(sellerKra, contentWidth / 3 - 5)
  const sellerTelLines = doc.splitTextToSize(sellerTel, contentWidth / 3 - 5)

  y = signatureHeadingsY + sellerLines.length * 4 + signatureDetailsGap

  sellerNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerNameLines.length * 4

  sellerIdLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerIdLines.length * 4

  sellerKraLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerKraLines.length * 4

  sellerTelLines.forEach((line, index) => {
    doc.text(line, leftMargin + 2, y + index * 4)
  })
  y += sellerTelLines.length * 4

  const sellerEndY = y

  // Witness details (middle column) with text wrapping
  y = signatureHeadingsY + witnessLines.length * 4 + signatureDetailsGap
  const witnessName = `NAME: ${agreementData.witness?.name || ''}`
  const witnessId = `ID NO: ${agreementData.witness?.id || ''}`
  const witnessTel = `TEL NO: ${agreementData.witness?.telephone || ''}`

  const witnessNameLines = doc.splitTextToSize(witnessName, contentWidth / 3 - 5)
  const witnessIdLines = doc.splitTextToSize(witnessId, contentWidth / 3 - 5)
  const witnessTelLines = doc.splitTextToSize(witnessTel, contentWidth / 3 - 5)

  witnessNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 7, y + index * 4)
  })
  y += witnessNameLines.length * 4

  witnessIdLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 7, y + index * 4)
  })
  y += witnessIdLines.length * 4

  witnessTelLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 3 + 7, y + index * 4)
  })
  y += witnessTelLines.length * 4

  const witnessEndY = y

  // Next of Kin details (right column) with text wrapping
  y = signatureHeadingsY + nextOfKinLines.length * 4 + nextOfKinDetailsGap
  const nextOfKinName = `NAME: ${agreementData.nextOfKin?.name || ''}`
  const nextOfKinId = `ID NO: ${agreementData.nextOfKin?.id || ''}`
  const nextOfKinKra = `KRA PIN: ${agreementData.nextOfKin?.kraNo || ''}`
  const nextOfKinTel = `TEL NO: ${agreementData.nextOfKin?.telephone || ''}`

  const nextOfKinNameLines = doc.splitTextToSize(nextOfKinName, contentWidth / 3 - 5)
  const nextOfKinIdLines = doc.splitTextToSize(nextOfKinId, contentWidth / 3 - 5)
  const nextOfKinKraLines = doc.splitTextToSize(nextOfKinKra, contentWidth / 3 - 5)
  const nextOfKinTelLines = doc.splitTextToSize(nextOfKinTel, contentWidth / 3 - 5)

  nextOfKinNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 10, y + index * 4)
  })
  y += nextOfKinNameLines.length * 4

  nextOfKinIdLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 10, y + index * 4)
  })
  y += nextOfKinIdLines.length * 4

  nextOfKinKraLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 10, y + index * 4)
  })
  y += nextOfKinKraLines.length * 4

  nextOfKinTelLines.forEach((line, index) => {
    doc.text(line, leftMargin + (contentWidth / 3) * 2 + 10, y + index * 4)
  })
  y += nextOfKinTelLines.length * 4
  y = Math.max(sellerEndY, witnessEndY, y)

  // Add Payment Details below the witness section
  y += 8 // Increased space before payment details

  doc.setFont('times', 'bold')
  const paymentDetails = 'PAYMENT DETAILS'
  const paymentLines = doc.splitTextToSize(paymentDetails, contentWidth)

  paymentLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })

  const paymentDetailsWidth = doc.getTextWidth(paymentLines[0])

  doc.line(leftMargin, y + 1, leftMargin + paymentDetailsWidth, y + 1)
  y += paymentLines.length * 4 + 2

  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Payment details with text wrapping - Single column format like Next of Kin
  const accountName = `ACCOUNT NAME: ${agreementData.account?.accountTitle || ''}`
  const accountNo = `ACCOUNT NO: ${agreementData.account?.accountNumber || ''}`
  const bankName = `BANK: ${agreementData.account?.bankName || ''}`
  const branchName = `BRANCH: ${agreementData.account?.branchName || ''}`
  const paybill = `PAYBILL: ${agreementData.paybill || ''}`

  const accountNameLines = doc.splitTextToSize(accountName, contentWidth)
  const accountNoLines = doc.splitTextToSize(accountNo, contentWidth)
  const bankNameLines = doc.splitTextToSize(bankName, contentWidth)
  const branchNameLines = doc.splitTextToSize(branchName, contentWidth)
  const paybillLines = doc.splitTextToSize(paybill, contentWidth)

  // Single column format - all fields aligned vertically
  accountNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNameLines.length * 4 // Removed extra spacing after account name

  accountNoLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNoLines.length * 4 // Removed extra spacing after account number

  bankNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += bankNameLines.length * 4 // Removed extra spacing after bank name

  branchNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += branchNameLines.length * 4

  // Add Paybill field below the account details
  paybillLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += paybillLines.length * 4

  // Now return the complete PDF data
  return doc.output('datauristring')
}
