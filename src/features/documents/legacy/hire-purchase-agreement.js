// Ported unchanged from the legacy app (src/views/apps/user/list). These layouts are the signed legal/billing
// documents; change them deliberately. Data is supplied in the legacy shape by ../adapters.ts.

import jsPDF from 'jspdf'

import { shouldIncludeHpAdditionalNotes } from './should-include-hp-additional-notes'

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

export const generateHpAgreementPDF = agreementData => {
  const doc = new jsPDF()
  let y = 20 // Starting position - increased for better header spacing

  // Define content boundaries
  const leftMargin = 10
  const rightMargin = 200 // A4 width is 210, so 200 gives 10px margin
  const contentWidth = rightMargin - leftMargin

  // Header
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('CAR SALE AGREEMENT', 105, y, { align: 'center' })
  y += 12
  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Buyer and Motor details with text wrapping
  const buyerName = `NAME OF BUYER: ${agreementData.user?.name || ''}`

  // Debug: Log car data to see what's available

  // Build motor name with fallback logic
  let motorName = ''

  if (agreementData.car?.makeLabel && agreementData.car.makeLabel !== 'Unknown Make') {
    motorName = `MOTOR: ${agreementData.car.makeLabel}`
  } else if (agreementData.car?.brandName && agreementData.car?.carName) {
    motorName = `MOTOR: ${agreementData.car.brandName} ${agreementData.car.carName}`
  } else if (agreementData.car?.makeName) {
    motorName = `MOTOR: ${agreementData.car.makeName}`
  } else if (agreementData.car?.label) {
    // Extract the make part from the label (remove the chassis number part)
    const labelParts = agreementData.car.label.split(' (')

    motorName = `MOTOR: ${labelParts[0]}`
  } else if (agreementData.car?.make && agreementData.car?.model) {
    // Construct from make and model if available
    const makeName = typeof agreementData.car.make === 'object' ? agreementData.car.make.name : agreementData.car.make

    motorName = `MOTOR: ${makeName} ${agreementData.car.model}`
  } else if (agreementData.car?.model) {
    motorName = `MOTOR: ${agreementData.car.model}`
  } else {
    motorName = 'MOTOR: Unknown Make'
  }


  const buyerLines = doc.splitTextToSize(buyerName, contentWidth / 2 - 5)
  const motorLines = doc.splitTextToSize(motorName, contentWidth / 2 - 5)

  buyerLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  motorLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(buyerLines.length, motorLines.length) * 4 + 2

  // ID and CHASIS NO
  const userId = `ID: ${agreementData.user?.id || ''}`
  const chasisNo = `CHASIS NO: ${agreementData.car?.chesisNo || ''}`
  const idLines = doc.splitTextToSize(userId, contentWidth / 2 - 5)
  const chasisLines = doc.splitTextToSize(chasisNo, contentWidth / 2 - 5)

  idLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  chasisLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(idLines.length, chasisLines.length) * 4 + 2

  // KRA PIN and ENG NO
  const kraPin = `KRA PIN: ${agreementData.user?.kraNo || ''}`
  const engNo = `ENG NO: ${agreementData.car?.engNo || ''}`
  const kraLines = doc.splitTextToSize(kraPin, contentWidth / 2 - 5)
  const engLines = doc.splitTextToSize(engNo, contentWidth / 2 - 5)

  kraLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  engLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(kraLines.length, engLines.length) * 4 + 2

  // P.O.BOX and REG NO
  const poBox = `P.O.BOX: ${agreementData.user?.poBox || ''}`
  const regNo = `REG NO: ${agreementData.car?.regNo || ''}`
  const poBoxLines = doc.splitTextToSize(poBox, contentWidth / 2 - 5)
  const regLines = doc.splitTextToSize(regNo, contentWidth / 2 - 5)

  poBoxLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  regLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(poBoxLines.length, regLines.length) * 4 + 2

  // TEL NO and MODEL
  const telNo = `TEL NO: ${agreementData.user?.telephone || ''}`
  const model = `MODEL: ${agreementData.car?.model || ''}`
  const telLines = doc.splitTextToSize(telNo, contentWidth / 2 - 5)
  const modelLines = doc.splitTextToSize(model, contentWidth / 2 - 5)

  telLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  modelLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(telLines.length, modelLines.length) * 4 + 2

  // COLOUR and CC
  const colour = `COLOUR: ${agreementData.car?.color || ''}`
  const cc = `CC: ${agreementData.car?.cc || ''}`
  const colourLines = doc.splitTextToSize(colour, contentWidth / 2 - 5)
  const ccLines = doc.splitTextToSize(cc, contentWidth / 2 - 5)

  colourLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  ccLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(colourLines.length, ccLines.length) * 4 + 2

  // Financials with text wrapping
  doc.setFont('times', 'bold')
  const agreedPrice = agreementData.agreedPrice || 0
  const deposit = agreementData.deposit || 0
  const balance = agreementData.balance || 0

  // Agreed Price with better formatting
  const agreedPriceLabel = 'AGREED PRICE:'
  const agreedPriceAmount = `KSHS. ${agreedPrice.toLocaleString()} (${numberToWords(agreedPrice)})`
  const agreedPriceText = `${agreedPriceLabel} ${agreedPriceAmount}`
  const agreedPriceLines = doc.splitTextToSize(agreedPriceText, contentWidth)

  agreedPriceLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const agreedPriceLabelWidth = doc.getTextWidth(agreedPriceLabel)

  doc.line(leftMargin, y + 1, leftMargin + agreedPriceLabelWidth, y + 1)
  y += agreedPriceLines.length * 4 + 2

  // Deposit with better formatting
  const depositLabel = 'DEPOSIT:'
  const depositAmount = `KSHS. ${deposit.toLocaleString()} (${numberToWords(deposit)})`
  const depositText = `${depositLabel} ${depositAmount}`
  const depositLines = doc.splitTextToSize(depositText, contentWidth)

  depositLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const depositLabelWidth = doc.getTextWidth(depositLabel)

  doc.line(leftMargin, y + 1, leftMargin + depositLabelWidth, y + 1)
  y += depositLines.length * 4 + 2

  // Add "Paid as Vehicle" section if trade-in is selected (moved here after deposit)
  if (agreementData.hpTradeIn === 'yes' && agreementData.hpTradeInCar) {
    const paidAsVehicleLabel = 'PAID AS VEHICLE:'

    // Build the complete car details in a single row format with fallback logic
    let carMakeModel = ''
    const tradeInCar = agreementData.hpTradeInCar

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

    if (agreementData.hpTradeInCar.chesisNo) {
      carDetails.push(`CHASSIS: ${agreementData.hpTradeInCar.chesisNo}`)
    }

    if (agreementData.hpTradeInCar.engNo) {
      carDetails.push(`ENG: ${agreementData.hpTradeInCar.engNo}`)
    }

    if (agreementData.hpTradeInCar.regNo) {
      carDetails.push(`REG: ${agreementData.hpTradeInCar.regNo}`)
    }

    // Combine car make/model with details in a single line
    const carDetailsText = carDetails.length > 0 ? ` ${carDetails.join(' ')}` : ''
    const paidAsVehicleText = `${paidAsVehicleLabel} Make: ${carMakeModel}${carDetailsText}`
    const paidAsVehicleLines = doc.splitTextToSize(paidAsVehicleText, contentWidth)

    paidAsVehicleLines.forEach((line, index) => {
      doc.text(line, leftMargin, y + index * 4)
    })
    const paidAsVehicleLabelWidth = doc.getTextWidth(paidAsVehicleLabel)

    doc.line(leftMargin, y + 1, leftMargin + paidAsVehicleLabelWidth, y + 1)
    y += paidAsVehicleLines.length * 4 + 2

    // Add vehicle amount if provided
    if (agreementData.hpTradeInCarAmount) {
      doc.setFont('times', 'bold')
      doc.setFontSize(10)
      const vehicleAmountLabel = 'PRICE:'
      const vehicleAmount = Number(agreementData.hpTradeInCarAmount) || 0
      const vehicleAmountValue = `KSHS. ${vehicleAmount.toLocaleString()} (${numberToWords(vehicleAmount)})`
      const vehicleAmountText = `${vehicleAmountLabel} ${vehicleAmountValue}`
      const vehicleAmountLines = doc.splitTextToSize(vehicleAmountText, contentWidth)

      vehicleAmountLines.forEach((line, index) => {
        doc.text(line, leftMargin, y + index * 4)
      })
      const vehicleAmountLabelWidth = doc.getTextWidth(vehicleAmountLabel)

      doc.line(leftMargin, y + 1, leftMargin + vehicleAmountLabelWidth, y + 1)
      y += vehicleAmountLines.length * 4 + 2
    }

    // Add remaining deposit amount if deposit and trade-in car amount are provided
    if (agreementData.deposit && agreementData.hpTradeInCarAmount) {
      const deposit = Number(agreementData.deposit) || 0
      const tradeInAmount = Number(agreementData.hpTradeInCarAmount) || 0
      const remainingDeposit = deposit - tradeInAmount

      if (remainingDeposit > 0) {
        doc.setFont('times', 'bold')
        doc.setFontSize(10)
        const remainingDepositLabel = 'REMAINING DEPOSIT AMOUNT:'
        const paymentMethod = agreementData.remainingDepositPaymentMethod || ''
        const remainingDepositValue = `KSHS. ${remainingDeposit.toLocaleString()} (${numberToWords(remainingDeposit)})${paymentMethod ? ` PAID AS ${paymentMethod.toUpperCase()}` : ''}`
        const remainingDepositText = `${remainingDepositLabel} ${remainingDepositValue}`
        const remainingDepositLines = doc.splitTextToSize(remainingDepositText, contentWidth)

        remainingDepositLines.forEach((line, index) => {
          doc.text(line, leftMargin, y + index * 4)
        })
        const remainingDepositLabelWidth = doc.getTextWidth(remainingDepositLabel)

        doc.line(leftMargin, y + 1, leftMargin + remainingDepositLabelWidth, y + 1)
        y += remainingDepositLines.length * 4 + 2
      }
    }
  }

    // Balance with better formatting
  const balanceLabel = 'BALANCE:'
  const balanceAmount = `KSHS. ${balance.toLocaleString()} (${numberToWords(balance)})`

    // Generate dynamic installment payment text
  let balanceCondition = 'TO BE PAID AFTER SELLING THE VEHICLE.'

  if (agreementData.installmentType && agreementData.installmentDuration && balance > 0) {
    const installmentType = agreementData.installmentType
    const installmentDuration = agreementData.installmentDuration
    const monthlyPayment = Math.ceil(balance / installmentDuration)

    // Use selected starting date or calculate default
    let startDateStr

    if (agreementData.startingDate) {
      const selectedDate = new Date(agreementData.startingDate)

      startDateStr = selectedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    } else {
      // Fallback to calculated date (current date + 1 month)
      const startDate = new Date()

      startDate.setMonth(startDate.getMonth() + 1)
      startDateStr = startDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    balanceCondition = `TO BE PAID WITHIN ${installmentDuration} ${installmentType === 'monthly' ? 'MONTHS' : 'YEARS'} EACH AT KSHS. ${monthlyPayment.toLocaleString()} STARTING FROM ${startDateStr.toUpperCase()}`
  }

  // Set font to bold for balance section BEFORE splitting text
  doc.setFont('times', 'bold')
  doc.setFontSize(10)

  // Combine balance amount and condition in one line like the image
  const balanceText = `${balanceLabel} ${balanceAmount} ${balanceCondition}`
  const balanceLines = doc.splitTextToSize(balanceText, contentWidth)

  balanceLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })

  // Underline only the "BALANCE:" label
  doc.line(leftMargin, y + 1, leftMargin + doc.getTextWidth(balanceLabel), y + 1)
  y += balanceLines.length * 4

  y += 1

  // Add tracker note if tracker is set to "add"
  if (agreementData.tracker === 'add' && agreementData.trackerFee && agreementData.trackerDuration) {
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    const trackerText = `NOTE: KSHS. ${agreementData.trackerFee.toLocaleString()} FOR CAR TRACKER TO BE PAID SEPARATELY WITHIN ${agreementData.trackerDuration.toUpperCase()}.`
    const trackerLines = doc.splitTextToSize(trackerText, contentWidth)

    trackerLines.forEach((line, index) => {
      doc.text(line, leftMargin, y + index * 4)
    })
    y += trackerLines.length * 4 + 2
  }

  // Add Additional Notes text area when enabled during agreement creation
  if (shouldIncludeHpAdditionalNotes(agreementData)) {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)

    // Draw text area border
    const textAreaWidth = contentWidth
    const textAreaHeight = 20 // Two lines height

    doc.rect(leftMargin, y, textAreaWidth, textAreaHeight)

    // Add placeholder text or leave empty for user to fill
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.text('Additional Notes:', leftMargin + 2, y + 6)
    doc.text('______________________________________________', leftMargin + 2, y + 12)
    doc.text('______________________________________________', leftMargin + 2, y + 18)

    y += textAreaHeight + 5 // Move cursor below text area
  }

  // Add logbook checkboxes (always show, not just when trade-in is selected)
  doc.setFont('times', 'normal')

  // Debug: Log checkbox values
  console.log('HP Agreement PDF - Checkbox values:', {
    physicalLogbook: agreementData.physicalLogbook,
    transferLogbook: agreementData.transferLogbook,
    uponPayment: agreementData.uponPayment,
    type: typeof agreementData.physicalLogbook
  })

  // Draw first checkbox before PHYSICAL LOGBOOK
  const checkbox1X = leftMargin
  const checkbox1Y = y - 3

  doc.rect(checkbox1X, checkbox1Y, 4, 4, 'S') // Small square

  if (agreementData.physicalLogbook === true || agreementData.physicalLogbook === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox1X + 0.5, checkbox1Y + 2, checkbox1X + 1.5, checkbox1Y + 3.5) // First line of check
    doc.line(checkbox1X + 1.5, checkbox1Y + 3.5, checkbox1X + 3.5, checkbox1Y + 0.5) // Second line of check
  }

  doc.text('PHYSICAL LOGBOOK', leftMargin + 10, y)

  // Draw second checkbox before TRANSFER LOGBOOK
  const checkbox2X = leftMargin + 50
  const checkbox2Y = y - 3

  doc.rect(checkbox2X, checkbox2Y, 4, 4, 'S') // Small square

  if (agreementData.transferLogbook === true || agreementData.transferLogbook === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox2X + 0.5, checkbox2Y + 2, checkbox2X + 1.5, checkbox2Y + 3.5) // First line of check
    doc.line(checkbox2X + 1.5, checkbox2Y + 3.5, checkbox2X + 3.5, checkbox2Y + 0.5) // Second line of check
  }

  doc.text('TRANSFER LOGBOOK', leftMargin + 60, y)

  // Draw third checkbox before UPON PAYMENT
  const checkbox3X = leftMargin + 100
  const checkbox3Y = y - 3

  doc.rect(checkbox3X, checkbox3Y, 4, 4, 'S') // Small square

  if (agreementData.uponPayment === true || agreementData.uponPayment === 'true') {
    // Draw checkmark using lines
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox3X + 0.5, checkbox3Y + 2, checkbox3X + 1.5, checkbox3Y + 3.5) // First line of check
    doc.line(checkbox3X + 1.5, checkbox3Y + 3.5, checkbox3X + 3.5, checkbox3Y + 0.5) // Second line of check
  }

  doc.text('UPON PAYMENT.', leftMargin + 110, y)
  y += 6

  doc.setFont('times', 'bold')
  const agreementText = 'IT IS FURTHER AGREED BETWEEN THE BUYER AND THE SELLER AS FOLLOWS:'
  const agreementLines = doc.splitTextToSize(agreementText, contentWidth)

  agreementLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const agreementWidth = doc.getTextWidth(agreementLines[0])

  doc.line(leftMargin, y + 1, leftMargin + agreementWidth, y + 1)
  y += agreementLines.length * 4 + 3

  // Clauses with improved text wrapping
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  if (doc.setCharSpace) doc.setCharSpace(0)

  const clauses = [
    'The aforesaid motor vehicle is sold on basis "AS IT IS" and the seller does not give any guarantee whatsoever to the buyer.',
    'The buyer has confirmed by signing this agreement that he/she has taken possession of a fore said motor vehicle on the basis of "AS IT IS" and upon being satisfied that the motor vehicle is in a proper condition.',
    'The deposits paid here by the buyer shall not be refundable and the seller shall have the right to Repossession the a fore said motor vehicle in the event the buyer defaults in any one instalment and also have the right to sell the motor vehicle to anybody else. Repossession charges or any other charges incurred as a result of the above shall be the sole responsibility of the buyer.',
    'Immediately the buyer takes possession of the motor vehicle, he/she shall be responsible to cater for Insurance cover at an insurance company of his or her choice, road license, etc.',
    'The Buyer further confirms that the original Logbook remains and shall at all times hereto in the custody and possession of the Seller until the full payment of the purchaser price and transfer effected in the name of the Buyer. Client is required to provide payment confirmation for verification to facilitate the transfer process at the point of transfer.',
    'Any claims, offenses etc. Arising from the use of the vehicle from the date of delivery shall be the sole responsibility of the purchaser and vendor shall not in any way be liable for the same.',
    "It's the responsibility of the customer to apply for the change of the ownership of the above vehicle as soon as possible.",
    'Client is required to provide payment confirmation for verification to facilitate the transfer process for transfer.'
  ]

  const bulletX = leftMargin + 2
  const textX = bulletX + 4
  const maxWidth = contentWidth - 6 // Account for bullet and indentation

  clauses.forEach(clause => {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    if (doc.setCharSpace) doc.setCharSpace(0)

    const lines = doc.splitTextToSize(clause, maxWidth)

    doc.text(`•`, bulletX, y)
    doc.text(lines[0], textX, y)

    for (let i = 1; i < lines.length; i++) {
      y += 4
      doc.text(lines[i], textX, y)
    }

    y += 4
  })
  y += 3

  // Witnessing clause with agreement creation date
  y += 2
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
  y += witnessingLines.length * 4 + 3

  // Signatures and Payment Details with text wrapping
  doc.setFont('times', 'bold')
  const buyerSignature = 'SIGNED BY THE SAID BUYER'
  const buyerSigLines = doc.splitTextToSize(buyerSignature, contentWidth)

  buyerSigLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += buyerSigLines.length * 4 + 8 // Further reduced spacing for tighter layout

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

  // Add space between SIGNED BY THE SAID SELLER section and PAYMENT DETAILS
  y += 8

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

  // Payment details with text wrapping
  const accountName = `ACCOUNT NAME: ${agreementData.account?.accountTitle || ''}`
  const accountNo = `ACCOUNT NO: ${agreementData.account?.accountNumber || ''}`
  const bankName = `BANK: ${agreementData.account?.bankName || ''}`
  const branchName = `BRANCH: ${agreementData.account?.branchName || ''}`
  const paybill = `PAYBILL: ${agreementData.paybill || ''}`

  const accountNameLines = doc.splitTextToSize(accountName, contentWidth / 2 - 10)
  const accountNoLines = doc.splitTextToSize(accountNo, contentWidth / 2 - 10)
  const bankNameLines = doc.splitTextToSize(bankName, contentWidth / 2 - 10)
  const branchNameLines = doc.splitTextToSize(branchName, contentWidth / 2 - 10)
  const paybillLines = doc.splitTextToSize(paybill, contentWidth / 2 - 10)

  // Left column: Account Name and Account Number
  accountNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNameLines.length * 4 // Removed extra spacing after account name

  accountNoLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNoLines.length * 4 // Removed extra spacing after account number

  // Reset y for right column
  y -= (accountNameLines.length + accountNoLines.length) * 4 // Adjusted for reduced spacing

  // Right column: Bank and Branch
  bankNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += bankNameLines.length * 4 // Removed extra spacing after bank name

  branchNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += branchNameLines.length * 4

  // Add Paybill field below the account details
  paybillLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += paybillLines.length * 4

  // Add Tracker supervised by text at bottom right - only when HP trade-in is selected
  if (agreementData.hpTradeIn === 'yes') {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)

    const trackerText = 'Tracker supervised by: ……….'
    const trackerTextWidth = doc.getTextWidth(trackerText)
    const pageWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const trackerRightMargin = 10 // 10mm from right edge
    const trackerBottomMargin = 2 // 5mm from bottom edge

    // Position at bottom right of the page - ensure it's within page bounds
    const trackerX = pageWidth - trackerRightMargin - trackerTextWidth
    const trackerY = pageHeight - trackerBottomMargin

    // Ensure text doesn't go off the page (left edge)
    const finalX = Math.max(trackerX, leftMargin)

    doc.text(trackerText, finalX, trackerY)
  }

  // Generate filename with buyer name, agreement type, and id
  let filename = ''

  // Add buyer name first if available
  if (agreementData.user?.name) {
    filename += agreementData.user.name.replace(/[^a-zA-Z0-9]/g, '-')
  }

  // Add agreement type
  filename += filename ? '-hp-agreement' : 'hp-agreement'

  // Add ID
  const agreementId = agreementData.slkId || agreementData.id || ''

  if (agreementId) {
    filename += `-${agreementId}`
  }

  // Clean up filename and add .pdf extension
  filename = filename.replace(/--+/g, '-').replace(/^-|-$/g, '') + '.pdf'

  doc.save(filename)
}

// Email version that returns base64 data instead of triggering download
export const generateHpAgreementPDFForEmail = agreementData => {
  const doc = new jsPDF()
  let y = 20 // Starting position - increased for better header spacing

  // Define content boundaries
  const leftMargin = 10
  const rightMargin = 200 // A4 width is 210, so 200 gives 10px margin
  const contentWidth = rightMargin - leftMargin

  // Header
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('CAR SALE AGREEMENT', 105, y, { align: 'center' })
  y += 12
  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Buyer and Motor details with text wrapping
  const buyerName = `NAME OF BUYER: ${agreementData.user?.name || ''}`

  // Build motor name with fallback logic
  let motorName = ''

  if (agreementData.car?.makeLabel && agreementData.car.makeLabel !== 'Unknown Make') {
    motorName = `MOTOR: ${agreementData.car.makeLabel}`
  } else if (agreementData.car?.brandName && agreementData.car?.carName) {
    motorName = `MOTOR: ${agreementData.car.brandName} ${agreementData.car.carName}`
  } else if (agreementData.car?.makeName) {
    motorName = `MOTOR: ${agreementData.car.makeName}`
  } else if (agreementData.car?.label) {
    const labelParts = agreementData.car.label.split(' (')

    motorName = `MOTOR: ${labelParts[0]}`
  } else if (agreementData.car?.make && agreementData.car?.model) {
    const makeName = typeof agreementData.car.make === 'object' ? agreementData.car.make.name : agreementData.car.make

    motorName = `MOTOR: ${makeName} ${agreementData.car.model}`
  } else if (agreementData.car?.model) {
    motorName = `MOTOR: ${agreementData.car.model}`
  } else {
    motorName = 'MOTOR: Unknown Make'
  }

  const buyerLines = doc.splitTextToSize(buyerName, contentWidth / 2 - 5)
  const motorLines = doc.splitTextToSize(motorName, contentWidth / 2 - 5)

  buyerLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  motorLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(buyerLines.length, motorLines.length) * 4 + 2

  // ID and CHASIS NO
  const userId = `ID: ${agreementData.user?.id || ''}`
  const chasisNo = `CHASIS NO: ${agreementData.car?.chesisNo || ''}`
  const idLines = doc.splitTextToSize(userId, contentWidth / 2 - 5)
  const chasisLines = doc.splitTextToSize(chasisNo, contentWidth / 2 - 5)

  idLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  chasisLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(idLines.length, chasisLines.length) * 4 + 2

  // KRA PIN and ENG NO
  const kraPin = `KRA PIN: ${agreementData.user?.kraNo || ''}`
  const engNo = `ENG NO: ${agreementData.car?.engNo || ''}`
  const kraLines = doc.splitTextToSize(kraPin, contentWidth / 2 - 5)
  const engLines = doc.splitTextToSize(engNo, contentWidth / 2 - 5)

  kraLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  engLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(kraLines.length, engLines.length) * 4 + 2

  // P.O.BOX and REG NO
  const poBox = `P.O.BOX: ${agreementData.user?.poBox || ''}`
  const regNo = `REG NO: ${agreementData.car?.regNo || ''}`
  const poBoxLines = doc.splitTextToSize(poBox, contentWidth / 2 - 5)
  const regLines = doc.splitTextToSize(regNo, contentWidth / 2 - 5)

  poBoxLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  regLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(poBoxLines.length, regLines.length) * 4 + 2

  // TEL NO and MODEL
  const telNo = `TEL NO: ${agreementData.user?.telephone || ''}`
  const model = `MODEL: ${agreementData.car?.model || ''}`
  const telLines = doc.splitTextToSize(telNo, contentWidth / 2 - 5)
  const modelLines = doc.splitTextToSize(model, contentWidth / 2 - 5)

  telLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  modelLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(telLines.length, modelLines.length) * 4 + 2

  // COLOUR and CC
  const colour = `COLOUR: ${agreementData.car?.color || ''}`
  const cc = `CC: ${agreementData.car?.cc || ''}`
  const colourLines = doc.splitTextToSize(colour, contentWidth / 2 - 5)
  const ccLines = doc.splitTextToSize(cc, contentWidth / 2 - 5)

  colourLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  ccLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 5, y + index * 4)
  })
  y += Math.max(colourLines.length, ccLines.length) * 4 + 2

  // Financials with text wrapping
  doc.setFont('times', 'bold')
  const agreedPrice = agreementData.agreedPrice || 0
  const deposit = agreementData.deposit || 0
  const balance = agreementData.balance || 0

  // Agreed Price with better formatting
  const agreedPriceLabel = 'AGREED PRICE:'
  const agreedPriceAmount = `KSHS. ${agreedPrice.toLocaleString()} (${numberToWords(agreedPrice)})`
  const agreedPriceText = `${agreedPriceLabel} ${agreedPriceAmount}`
  const agreedPriceLines = doc.splitTextToSize(agreedPriceText, contentWidth)

  agreedPriceLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const agreedPriceLabelWidth = doc.getTextWidth(agreedPriceLabel)

  doc.line(leftMargin, y + 1, leftMargin + agreedPriceLabelWidth, y + 1)
  y += agreedPriceLines.length * 4 + 2

  // Deposit with better formatting
  const depositLabel = 'DEPOSIT:'
  const depositAmount = `KSHS. ${deposit.toLocaleString()} (${numberToWords(deposit)})`
  const depositText = `${depositLabel} ${depositAmount}`
  const depositLines = doc.splitTextToSize(depositText, contentWidth)

  depositLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const depositLabelWidth = doc.getTextWidth(depositLabel)

  doc.line(leftMargin, y + 1, leftMargin + depositLabelWidth, y + 1)
  y += depositLines.length * 4 + 2

  // Add "Paid as Vehicle" section if trade-in is selected
  if (agreementData.hpTradeIn === 'yes' && agreementData.hpTradeInCar) {
    const paidAsVehicleLabel = 'PAID AS VEHICLE:'

    let carMakeModel = ''
    const tradeInCar = agreementData.hpTradeInCar

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

    if (agreementData.hpTradeInCar.chesisNo) {
      carDetails.push(`CHASSIS: ${agreementData.hpTradeInCar.chesisNo}`)
    }

    if (agreementData.hpTradeInCar.engNo) {
      carDetails.push(`ENG: ${agreementData.hpTradeInCar.engNo}`)
    }

    if (agreementData.hpTradeInCar.regNo) {
      carDetails.push(`REG: ${agreementData.hpTradeInCar.regNo}`)
    }

    const carDetailsText = carDetails.length > 0 ? ` ${carDetails.join(' ')}` : ''
    const paidAsVehicleText = `${paidAsVehicleLabel} Make: ${carMakeModel}${carDetailsText}`
    const paidAsVehicleLines = doc.splitTextToSize(paidAsVehicleText, contentWidth)

    paidAsVehicleLines.forEach((line, index) => {
      doc.text(line, leftMargin, y + index * 4)
    })
    const paidAsVehicleLabelWidth = doc.getTextWidth(paidAsVehicleLabel)

    doc.line(leftMargin, y + 1, leftMargin + paidAsVehicleLabelWidth, y + 1)
    y += paidAsVehicleLines.length * 4 + 2

    // Add vehicle amount if provided
    if (agreementData.hpTradeInCarAmount) {
      doc.setFont('times', 'bold')
      doc.setFontSize(10)
      const vehicleAmountLabel = 'PRICE:'
      const vehicleAmount = Number(agreementData.hpTradeInCarAmount) || 0
      const vehicleAmountValue = `KSHS. ${vehicleAmount.toLocaleString()} (${numberToWords(vehicleAmount)})`
      const vehicleAmountText = `${vehicleAmountLabel} ${vehicleAmountValue}`
      const vehicleAmountLines = doc.splitTextToSize(vehicleAmountText, contentWidth)

      vehicleAmountLines.forEach((line, index) => {
        doc.text(line, leftMargin, y + index * 4)
      })
      const vehicleAmountLabelWidth = doc.getTextWidth(vehicleAmountLabel)

      doc.line(leftMargin, y + 1, leftMargin + vehicleAmountLabelWidth, y + 1)
      y += vehicleAmountLines.length * 4 + 2
    }

    // Add remaining deposit amount if deposit and trade-in car amount are provided
    if (agreementData.deposit && agreementData.hpTradeInCarAmount) {
      const deposit = Number(agreementData.deposit) || 0
      const tradeInAmount = Number(agreementData.hpTradeInCarAmount) || 0
      const remainingDeposit = deposit - tradeInAmount

      if (remainingDeposit > 0) {
        doc.setFont('times', 'bold')
        doc.setFontSize(10)
        const remainingDepositLabel = 'REMAINING DEPOSIT AMOUNT:'
        const paymentMethod = agreementData.remainingDepositPaymentMethod || ''
        const remainingDepositValue = `KSHS. ${remainingDeposit.toLocaleString()} (${numberToWords(remainingDeposit)})${paymentMethod ? ` PAID AS ${paymentMethod.toUpperCase()}` : ''}`
        const remainingDepositText = `${remainingDepositLabel} ${remainingDepositValue}`
        const remainingDepositLines = doc.splitTextToSize(remainingDepositText, contentWidth)

        remainingDepositLines.forEach((line, index) => {
          doc.text(line, leftMargin, y + index * 4)
        })
        const remainingDepositLabelWidth = doc.getTextWidth(remainingDepositLabel)

        doc.line(leftMargin, y + 1, leftMargin + remainingDepositLabelWidth, y + 1)
        y += remainingDepositLines.length * 4 + 2
      }
    }
  }

  // Balance with better formatting
  const balanceLabel = 'BALANCE:'
  const balanceAmount = `KSHS. ${balance.toLocaleString()} (${numberToWords(balance)})`

  let balanceCondition = 'TO BE PAID AFTER SELLING THE VEHICLE.'

  if (agreementData.installmentType && agreementData.installmentDuration && balance > 0) {
    const installmentType = agreementData.installmentType
    const installmentDuration = agreementData.installmentDuration
    const monthlyPayment = Math.ceil(balance / installmentDuration)

    let startDateStr

    if (agreementData.startingDate) {
      const selectedDate = new Date(agreementData.startingDate)

      startDateStr = selectedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    } else {
      const startDate = new Date()

      startDate.setMonth(startDate.getMonth() + 1)
      startDateStr = startDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    balanceCondition = `TO BE PAID WITHIN ${installmentDuration} ${installmentType === 'monthly' ? 'MONTHS' : 'YEARS'} EACH AT KSHS. ${monthlyPayment.toLocaleString()} STARTING FROM ${startDateStr.toUpperCase()}`
  }

  doc.setFont('times', 'bold')
  doc.setFontSize(10)

  const balanceText = `${balanceLabel} ${balanceAmount} ${balanceCondition}`
  const balanceLines = doc.splitTextToSize(balanceText, contentWidth)

  balanceLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })

  doc.line(leftMargin, y + 1, leftMargin + doc.getTextWidth(balanceLabel), y + 1)
  y += balanceLines.length * 4

  y += 1

  // Add tracker note if tracker is set to "add"
  if (agreementData.tracker === 'add' && agreementData.trackerFee && agreementData.trackerDuration) {
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    const trackerText = `NOTE: KSHS. ${agreementData.trackerFee.toLocaleString()} FOR CAR TRACKER TO BE PAID SEPARATELY WITHIN ${agreementData.trackerDuration.toUpperCase()}.`
    const trackerLines = doc.splitTextToSize(trackerText, contentWidth)

    trackerLines.forEach((line, index) => {
      doc.text(line, leftMargin, y + index * 4)
    })
    y += trackerLines.length * 4 + 2
  }

  // Add Additional Notes text area when enabled during agreement creation
  if (shouldIncludeHpAdditionalNotes(agreementData)) {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)

    const textAreaWidth = contentWidth
    const textAreaHeight = 20

    doc.rect(leftMargin, y, textAreaWidth, textAreaHeight)

    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.text('Additional Notes:', leftMargin + 2, y + 6)
    doc.text('______________________________________________', leftMargin + 2, y + 12)
    doc.text('______________________________________________', leftMargin + 2, y + 18)

    y += textAreaHeight + 5
  }

  // Add logbook checkboxes
  doc.setFont('times', 'normal')

  const checkbox1X = leftMargin
  const checkbox1Y = y - 3

  doc.rect(checkbox1X, checkbox1Y, 4, 4, 'S')

  if (agreementData.physicalLogbook === true || agreementData.physicalLogbook === 'true') {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox1X + 0.5, checkbox1Y + 2, checkbox1X + 1.5, checkbox1Y + 3.5)
    doc.line(checkbox1X + 1.5, checkbox1Y + 3.5, checkbox1X + 3.5, checkbox1Y + 0.5)
  }

  doc.text('PHYSICAL LOGBOOK', leftMargin + 10, y)

  const checkbox2X = leftMargin + 50
  const checkbox2Y = y - 3

  doc.rect(checkbox2X, checkbox2Y, 4, 4, 'S')

  if (agreementData.transferLogbook === true || agreementData.transferLogbook === 'true') {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox2X + 0.5, checkbox2Y + 2, checkbox2X + 1.5, checkbox2Y + 3.5)
    doc.line(checkbox2X + 1.5, checkbox2Y + 3.5, checkbox2X + 3.5, checkbox2Y + 0.5)
  }

  doc.text('TRANSFER LOGBOOK', leftMargin + 60, y)

  const checkbox3X = leftMargin + 100
  const checkbox3Y = y - 3

  doc.rect(checkbox3X, checkbox3Y, 4, 4, 'S')

  if (agreementData.uponPayment === true || agreementData.uponPayment === 'true') {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(checkbox3X + 0.5, checkbox3Y + 2, checkbox3X + 1.5, checkbox3Y + 3.5)
    doc.line(checkbox3X + 1.5, checkbox3Y + 3.5, checkbox3X + 3.5, checkbox3Y + 0.5)
  }

  doc.text('UPON PAYMENT.', leftMargin + 110, y)
  y += 6

  doc.setFont('times', 'bold')
  const agreementText = 'IT IS FURTHER AGREED BETWEEN THE BUYER AND THE SELLER AS FOLLOWS:'
  const agreementLines = doc.splitTextToSize(agreementText, contentWidth)

  agreementLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const agreementWidth = doc.getTextWidth(agreementLines[0])

  doc.line(leftMargin, y + 1, leftMargin + agreementWidth, y + 1)
  y += agreementLines.length * 4 + 3

  // Clauses with improved text wrapping
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  if (doc.setCharSpace) doc.setCharSpace(0)

  const clauses = [
    'The aforesaid motor vehicle is sold on basis "AS IT IS" and the seller does not give any guarantee whatsoever to the buyer.',
    'The buyer has confirmed by signing this agreement that he/she has taken possession of a fore said motor vehicle on the basis of "AS IT IS" and upon being satisfied that the motor vehicle is in a proper condition.',
    'The deposits paid here by the buyer shall not be refundable and the seller shall have the right to Repossession the a fore said motor vehicle in the event the buyer defaults in any one instalment and also have the right to sell the motor vehicle to anybody else. Repossession charges or any other charges incurred as a result of the above shall be the sole responsibility of the buyer.',
    'Immediately the buyer takes possession of the motor vehicle, he/she shall be responsible to cater for Insurance cover at an insurance company of his or her choice, road license, etc.',
    'The Buyer further confirms that the original Logbook remains and shall at all times hereto in the custody and possession of the Seller until the full payment of the purchaser price and transfer effected in the name of the Buyer. Client is required to provide payment confirmation for verification to facilitate the transfer process at the point of transfer.',
    'Any claims, offenses etc. Arising from the use of the vehicle from the date of delivery shall be the sole responsibility of the purchaser and vendor shall not in any way be liable for the same.',
    "It's the responsibility of the customer to apply for the change of the ownership of the above vehicle as soon as possible.",
    'Client is required to provide payment confirmation for verification to facilitate the transfer process for transfer.'
  ]

  const bulletX = leftMargin + 2
  const textX = bulletX + 4
  const maxWidth = contentWidth - 6

  clauses.forEach(clause => {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    if (doc.setCharSpace) doc.setCharSpace(0)

    const lines = doc.splitTextToSize(clause, maxWidth)

    doc.text(`•`, bulletX, y)
    doc.text(lines[0], textX, y)

    for (let i = 1; i < lines.length; i++) {
      y += 4
      doc.text(lines[i], textX, y)
    }

    y += 4
  })
  y += 3

  // Witnessing clause with agreement creation date
  y += 2
  doc.setFont('times', 'bold')
  doc.setFontSize(10)

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
  y += witnessingLines.length * 4 + 3

  // Signatures and Payment Details with text wrapping
  doc.setFont('times', 'bold')
  const buyerSignature = 'SIGNED BY THE SAID BUYER'
  const buyerSigLines = doc.splitTextToSize(buyerSignature, contentWidth)

  buyerSigLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += buyerSigLines.length * 4 + 8

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

  // Add space between SIGNED BY THE SAID SELLER section and PAYMENT DETAILS
  y += 8

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

  // Payment details with text wrapping
  const accountName = `ACCOUNT NAME: ${agreementData.account?.accountTitle || ''}`
  const accountNo = `ACCOUNT NO: ${agreementData.account?.accountNumber || ''}`
  const bankName = `BANK: ${agreementData.account?.bankName || ''}`
  const branchName = `BRANCH: ${agreementData.account?.branchName || ''}`
  const paybill = `PAYBILL: ${agreementData.paybill || ''}`

  const accountNameLines = doc.splitTextToSize(accountName, contentWidth / 2 - 10)
  const accountNoLines = doc.splitTextToSize(accountNo, contentWidth / 2 - 10)
  const bankNameLines = doc.splitTextToSize(bankName, contentWidth / 2 - 10)
  const branchNameLines = doc.splitTextToSize(branchName, contentWidth / 2 - 10)
  const paybillLines = doc.splitTextToSize(paybill, contentWidth / 2 - 10)

  // Left column: Account Name and Account Number
  accountNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNameLines.length * 4

  accountNoLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNoLines.length * 4

  // Reset y for right column
  y -= (accountNameLines.length + accountNoLines.length) * 4

  // Right column: Bank and Branch
  bankNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += bankNameLines.length * 4

  branchNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += branchNameLines.length * 4

  // Add Paybill field below the account details
  paybillLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += paybillLines.length * 4

  // Add Tracker supervised by text at bottom right - only when HP trade-in is selected
  if (agreementData.hpTradeIn === 'yes') {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)

    const trackerText = 'Tracker supervised by: ……….'
    const trackerTextWidth = doc.getTextWidth(trackerText)
    const pageWidth = 210
    const pageHeight = 297
    const trackerRightMargin = 10
    const trackerBottomMargin = 2

    const trackerX = pageWidth - trackerRightMargin - trackerTextWidth
    const trackerY = pageHeight - trackerBottomMargin

    const finalX = Math.max(trackerX, leftMargin)

    doc.text(trackerText, finalX, trackerY)
  }

  // Return base64 data instead of saving
  return doc.output('datauristring')
}

export default generateHpAgreementPDF
