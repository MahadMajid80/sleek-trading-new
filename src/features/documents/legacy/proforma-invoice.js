// Ported unchanged from the legacy app (src/views/apps/user/list). These layouts are the signed legal/billing
// documents; change them deliberately. Data is supplied in the legacy shape by ../adapters.ts.

import jsPDF from 'jspdf'
import { toWords } from 'number-to-words'

export const generatePDF = async invoiceData => {

  // If we have accountId but no account object, fetch the account data
  let accountData = invoiceData.account

  if (invoiceData.accountId && !invoiceData.account) {
    try {
      const response = await fetch('/api/accounts')
      const accounts = await response.json()

      accountData = accounts.find(acc => acc._id === invoiceData.accountId)
    } catch (error) {
      console.error('Error fetching account data:', error)
    }
  }

  const doc = new jsPDF()
  let y = 40 // Increased starting position for more top space

  // Define content boundaries
  const leftMargin = 10
  const rightMargin = 200 // A4 width is 210, so 200 gives 10px margin
  const contentWidth = rightMargin - leftMargin

  // Function to wrap text to a specific width
  const wrapText = (text, maxWidth, x, y, lineHeight = 7) => {
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
  doc.text('PROFORMA INVOICE', 105, y, { align: 'center' })
  y += 15 // Increased spacing after title
  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Buyer and Motor details with text wrapping
  const buyerName = `NAME OF BUYER: ${invoiceData.user?.name || ''}`

  // Debug: Log the car object to see what's available

  // Use makeLabel if available, otherwise try to construct from brandName/carName or other fields
  let motorName

  if (invoiceData.car?.makeLabel) {
    // makeLabel already contains just the car name without chassis number
    motorName = `MOTOR: ${invoiceData.car.makeLabel}`
  } else if (invoiceData.car?.brandName && invoiceData.car?.carName) {
    // Use direct brandName and carName fields
    motorName = `MOTOR: ${invoiceData.car.brandName} ${invoiceData.car.carName}`
  } else if (invoiceData.car?.makeName) {
    // Use old makeName structure
    motorName = `MOTOR: ${invoiceData.car.makeName}`
  } else if (invoiceData.car?.label) {
    // Extract the make part from the label (remove the chassis number part)
    const labelParts = invoiceData.car.label.split(' (')

    motorName = `MOTOR: ${labelParts[0]}`
  } else if (invoiceData.car?.make && invoiceData.car?.model) {
    // Construct from make and model if available
    const makeName = typeof invoiceData.car.make === 'object' ? invoiceData.car.make.name : invoiceData.car.make

    motorName = `MOTOR: ${makeName} ${invoiceData.car.model}`
  } else {
    motorName = `MOTOR: ${invoiceData.car?.model || 'Unknown Make'}`
  }

  // Ensure no chassis number is included by removing any numbers after a dash or space
  // Remove chassis numbers in various formats
  motorName = motorName
    .replace(/[\s-]\d+.*$/, '') // Remove numbers after dash or space
    .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
    .replace(/[\s-][A-Z0-9]{6,}.*$/, '') // Remove alphanumeric codes 6+ characters
    .replace(/[\s-]\d{6,}.*$/, '') // Remove numeric codes 6+ digits
    .trim() // Remove extra spaces


  const buyerLines = doc.splitTextToSize(buyerName, contentWidth / 2 - 10)
  const motorLines = doc.splitTextToSize(motorName, contentWidth / 2 - 10)

  buyerLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  motorLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += Math.max(buyerLines.length, motorLines.length) * 4 + 2 // Reduced spacing between sections

  // ID and CHASIS NO
  const userId = `ID: ${invoiceData.user?.id || ''}`
  const chasisNo = `CHASIS NO: ${invoiceData.car?.chesisNo || ''}`
  const idLines = doc.splitTextToSize(userId, contentWidth / 2 - 10)
  const chasisLines = doc.splitTextToSize(chasisNo, contentWidth / 2 - 10)

  idLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  chasisLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += Math.max(idLines.length, chasisLines.length) * 4 + 2

  // KRA PIN and ENG NO
  const kraPin = `KRA PIN: ${invoiceData.user?.kraNo || ''}`
  const engNo = `ENG NO: ${invoiceData.car?.engNo || ''}`
  const kraLines = doc.splitTextToSize(kraPin, contentWidth / 2 - 10)
  const engLines = doc.splitTextToSize(engNo, contentWidth / 2 - 10)

  kraLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  engLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += Math.max(kraLines.length, engLines.length) * 4 + 2 // Reduced spacing between sections

  // P.O.BOX and REG NO
  const poBox = `P.O.BOX: ${invoiceData.user?.poBox || ''}`
  const regNo = `REG NO: ${invoiceData.car?.regNo || ''}`
  const poBoxLines = doc.splitTextToSize(poBox, contentWidth / 2 - 10)
  const regLines = doc.splitTextToSize(regNo, contentWidth / 2 - 10)

  poBoxLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  regLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += Math.max(poBoxLines.length, regLines.length) * 4 + 2 // Reduced spacing between sections

  // TEL NO and MODEL
  const telNo = `TEL NO: ${invoiceData.user?.telephone || ''}`
  const model = `MODEL: ${invoiceData.car?.model || ''}`
  const telLines = doc.splitTextToSize(telNo, contentWidth / 2 - 10)
  const modelLines = doc.splitTextToSize(model, contentWidth / 2 - 10)

  telLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  modelLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += Math.max(telLines.length, modelLines.length) * 4 + 2 // Reduced spacing between sections

  // COLOUR and CC
  const colour = `COLOUR: ${invoiceData.car?.color || ''}`
  const cc = `CC: ${invoiceData.car?.cc || ''}`
  const colourLines = doc.splitTextToSize(colour, contentWidth / 2 - 10)
  const ccLines = doc.splitTextToSize(cc, contentWidth / 2 - 10)

  colourLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  ccLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += Math.max(colourLines.length, ccLines.length) * 4 + 2 // Reduced spacing between sections

  // Financials with text wrapping
  doc.setFont('times', 'bold')
  const agreedPrice = invoiceData.agreedPrice || 0
  const deposit = invoiceData.deposit || 0
  const balance = invoiceData.balance || 0

  // Agreed Price with better formatting
  const agreedPriceLabel = 'AGREED PRICE:'
  const agreedPriceAmount = `KSHS. ${agreedPrice.toLocaleString()} (${toWords(agreedPrice).toUpperCase()} ONLY)`
  const agreedPriceText = `${agreedPriceLabel} ${agreedPriceAmount}`
  const agreedPriceLines = doc.splitTextToSize(agreedPriceText, contentWidth)

  agreedPriceLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const agreedPriceLabelWidth = doc.getTextWidth(agreedPriceLabel)

  doc.line(leftMargin, y + 1, leftMargin + agreedPriceLabelWidth, y + 1)
  y += agreedPriceLines.length * 4 + 8 // Increased spacing between financial items

  // Deposit with better formatting
  const depositLabel = 'DEPOSIT:'
  const depositAmount = `KSHS. ${deposit.toLocaleString()} (${toWords(deposit).toUpperCase()} ONLY)`
  const depositText = `${depositLabel} ${depositAmount}`
  const depositLines = doc.splitTextToSize(depositText, contentWidth)

  depositLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const depositLabelWidth = doc.getTextWidth(depositLabel)

  doc.line(leftMargin, y + 1, leftMargin + depositLabelWidth, y + 1)
  y += depositLines.length * 4 + 8 // Increased spacing between financial items

  // Balance with better formatting
  const balanceLabel = 'BALANCE:'
  const balanceAmount = `KSHS. ${balance.toLocaleString()} (${toWords(balance).toUpperCase()} ONLY)`
  const balanceText = `${balanceLabel} ${balanceAmount}`
  const balanceLines = doc.splitTextToSize(balanceText, contentWidth)

  balanceLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const balanceLabelWidth = doc.getTextWidth(balanceLabel)

  doc.line(leftMargin, y + 1, leftMargin + balanceLabelWidth, y + 1)
  y += balanceLines.length * 4 + 12 // Increased spacing before signature

  // Signature section
  doc.setFont('times', 'bold')
  const signatureTitle = 'SIGNATURE:'
  const signatureLines = doc.splitTextToSize(signatureTitle, contentWidth)

  signatureLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const signatureWidth = doc.getTextWidth(signatureLines[0])

  doc.line(leftMargin, y + 1, leftMargin + signatureWidth, y + 1)
  y += signatureLines.length * 4 + 60 // Large spacing after signature before account details

  // Account Details section
  doc.setFont('times', 'bold')
  const accountDetailsTitle = 'ACCOUNT DETAILS:'
  const accountDetailsLines = doc.splitTextToSize(accountDetailsTitle, contentWidth)

  accountDetailsLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  const accountDetailsWidth = doc.getTextWidth(accountDetailsLines[0])

  doc.line(leftMargin, y + 1, leftMargin + accountDetailsWidth, y + 1)
  y += accountDetailsLines.length * 4 + 8 // Increased spacing after account details title

  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  // Account details in two columns
  const accountName = `ACCOUNT NAME: ${accountData?.accountTitle || accountData?.label || 'No Account Selected'}`
  const accountNumber = `ACCOUNT NO: ${accountData?.accountNumber || 'N/A'}`
  const bankName = `BANK: ${accountData?.bankName || 'N/A'}`
  const branchName = `BRANCH: ${accountData?.branchName || 'N/A'}`

  const accountNameLines = doc.splitTextToSize(accountName, contentWidth / 2 - 10)
  const accountNumberLines = doc.splitTextToSize(accountNumber, contentWidth / 2 - 10)
  const bankNameLines = doc.splitTextToSize(bankName, contentWidth / 2 - 10)
  const branchNameLines = doc.splitTextToSize(branchName, contentWidth / 2 - 10)

  // Left column
  accountNameLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNameLines.length * 4 + 8 // Added extra spacing after account name

  accountNumberLines.forEach((line, index) => {
    doc.text(line, leftMargin, y + index * 4)
  })
  y += accountNumberLines.length * 4 + 8 // Added extra spacing after account number

  // Right column
  y -= (accountNameLines.length + accountNumberLines.length) * 4 + 16 // Adjusted for extra spacing
  bankNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += bankNameLines.length * 4 + 8 // Added extra spacing after bank name

  branchNameLines.forEach((line, index) => {
    doc.text(line, leftMargin + contentWidth / 2 + 10, y + index * 4)
  })
  y += branchNameLines.length * 4 + 20 // Final spacing after account details

  // Generate filename with user name, car name, and "proforma invoice"
  let filename = ''

  // Add user name first if available
  if (invoiceData.user?.name) {
    filename += invoiceData.user.name.replace(/[^a-zA-Z0-9]/g, '-')
  }

  // Add car name if available
  if (invoiceData.car) {
    let carName = ''

    // Prioritize brandName and carName fields
    if (invoiceData.car.brandName && invoiceData.car.carName) {
      carName = `${invoiceData.car.brandName} ${invoiceData.car.carName}`
    } else if (invoiceData.car.brandName) {
      carName = invoiceData.car.brandName
    } else if (invoiceData.car.carName) {
      carName = invoiceData.car.carName
    } else if (invoiceData.car.makeLabel && invoiceData.car.makeLabel !== 'Unknown Make') {
      carName = invoiceData.car.makeLabel
    } else if (invoiceData.car.label) {
      carName = invoiceData.car.label.replace(/[-(] *[A-Za-z0-9]+[)]?$/, '').trim()
    } else if (invoiceData.car.model) {
      carName = invoiceData.car.model
    }

    if (carName) {
      filename += filename ? `-${carName.replace(/[^a-zA-Z0-9]/g, '-')}` : carName.replace(/[^a-zA-Z0-9]/g, '-')
    }
  }

  // Add proforma-invoice at the end
  filename += filename ? '-proforma-invoice' : 'proforma-invoice'

  // Clean up filename and add .pdf extension
  filename = filename.replace(/--+/g, '-').replace(/^-|-$/g, '') + '.pdf'

  doc.save(filename)
}

