# MHC Excel File Analysis Summary

## 📊 File Overview
- **Original File**: `MHC - Báo giá khung XLKH.xlsx`
- **Processed File**: `mhc_bao_gia_khung_xlkh.xlsx` (renamed copy)
- **Total Sheets**: 2
- **Total Rows**: 454 across all sheets

## 📋 Sheet Structure

### Sheet 1: "XLKH các TH đặc biệt khác"
- **Purpose**: Special technical intervention services
- **Dimensions**: 231 rows × 26 columns
- **Header Row**: Row 9
- **Data Rows**: 222 (starting from row 10)
- **Services Identified**: 15 distinct services

**Column Structure:**
1. **STT** - Service number/category
2. **Dịch vụ định kỳ** - Service name
3. **Chi tiết công việc** - Work details
4. **Đơn giá** - Unit price
5. **Đơn vị** - Unit of measurement
6. **Số lượng** - Quantity
7. **Thời gian dự tính** - Estimated time
8. **Đơn giá (Chưa bao gồm VAT)** - Price excluding VAT
9. **Ghi chú** - Notes

**Service Categories:**
- Account cá nhân (Personal accounts)
- Fanpage/Group services
- YouTube video services
- TikTok video services
- Website/Blog services

### Sheet 2: "Bảo vệ bản quyền thương hiệu"
- **Purpose**: Brand copyright protection services
- **Dimensions**: 223 rows × 25 columns
- **Header Row**: Row 9
- **Data Rows**: 214 (starting from row 10)
- **Services Identified**: 11 distinct services

**Column Structure:**
1. **STT** - Service number
2. **Dịch vụ định kỳ** - Service name
3. **Chi tiết công việc** - Work details
4. **Meta** - Meta platform pricing
5. **Đơn vị** - Unit of measurement
6. **Số lượng** - Quantity
7. **Đơn giá (Chưa bao gồm VAT)** - Price excluding VAT
8. **Ghi chú** - Notes

**Service Categories:**
- Video brand protection
- Image brand protection
- Brand copyright protection
- Community guidance

## 💰 Price Analysis

### Price Formats Detected:
1. **Range Prices**: "15.000.000 - 25.000.000" VND
2. **Fixed Prices**: "30.000.000" VND
3. **Negotiable**: "Thoả thuận" / "Thỏa thuận"
4. **Free/Included**: "Tặng kèm"

### Price Examples:
- **Account Reporting**: 15,000,000 - 25,000,000 VND
- **Post Removal**: 17,000,000 - 18,000,000 VND
- **Video Protection Setup**: 30,000,000 VND (fixed)
- **Monthly Monitoring**: 15,000,000 - 18,000,000 VND/month

## 🔧 Technical Details

### Data Quality:
- **Headers**: Clearly identified in row 9 for both sheets
- **Categories**: Services grouped by type with section headers
- **Pricing**: Mixed format requiring parsing (Vietnamese number format with dots)
- **Text Content**: Rich Vietnamese text with detailed service descriptions

### Parsing Challenges:
1. **Vietnamese Number Format**: Uses dots as thousand separators (15.000.000)
2. **Mixed Data Types**: Numbers, text, and formatted strings in same columns
3. **Category Headers**: Interspersed with data rows
4. **Multi-line Cells**: Detailed descriptions span multiple lines

## 📁 Generated Output Files

### 1. JSON Files:
- **`parsed_excel_summary.json`**: Basic structure analysis
- **`mhc_parsed_detailed.json`**: Detailed parsing with price analysis

### 2. CSV Files:
- **`XLKH_các_TH_đặc_biệt_khác.csv`**: Technical intervention services
- **`Bảo_vệ_bản_quyền_thương_hiệu.csv`**: Brand protection services

### 3. Documentation:
- **`parsed_excel_preview.md`**: Human-readable analysis report
- **`EXCEL_ANALYSIS_SUMMARY.md`**: This comprehensive summary

## 🛠️ Python Scripts Created

### 1. `analyze_excel.py`
- **Purpose**: General Excel structure analysis
- **Features**: 
  - Automatic header detection
  - Sample data extraction
  - Column type analysis
  - Markdown report generation

### 2. `excel_parser.py`
- **Purpose**: Specialized MHC Excel parser
- **Features**:
  - Price parsing with Vietnamese number format
  - Service categorization
  - JSON and CSV export
  - Structured data extraction

## 📊 Key Insights

### Service Portfolio:
1. **Technical Intervention Services** (15 services):
   - Social media account management
   - Content removal and reporting
   - Platform-specific services (Facebook, YouTube, TikTok)

2. **Brand Protection Services** (11 services):
   - Video copyright protection
   - Image copyright protection
   - Automated monitoring systems
   - Content reporting and removal

### Pricing Structure:
- **Range**: 15M - 25M VND for complex services
- **Fixed**: 30M VND for system setup
- **Monthly**: 15M - 18M VND for ongoing monitoring
- **Negotiable**: For specialized or high-volume services

### Service Delivery:
- **Timeframes**: 1-45 days depending on complexity
- **Success Rates**: 90-95% for most services
- **Platforms**: Facebook, YouTube, TikTok, websites
- **Scope**: Individual accounts to enterprise-level protection

## 🎯 Usage Recommendations

### For Data Analysis:
1. Use `mhc_parsed_detailed.json` for programmatic access
2. Use CSV files for spreadsheet analysis
3. Price data includes both raw and parsed formats

### For Business Intelligence:
1. Service categories clearly defined
2. Price ranges identified for budgeting
3. Service complexity and timeframes documented
4. Success rates and limitations noted

### For System Integration:
1. Structured JSON format ready for database import
2. Price parsing handles Vietnamese number format
3. Category hierarchy preserved
4. Full service descriptions maintained

---
*Analysis completed using openpyxl and custom Python parsers*
*Generated on: 2026-05-10*