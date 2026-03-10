const fs = require('fs');
let code = fs.readFileSync('src/components/OrderPanel.tsx', 'utf8');

const startStr = "  // Neon Cyber Elements Components\n  const CyberInput = ({ label";
const startIndex = code.indexOf(startStr);
const endStr = "opacity-100\"></div>\n    </div>\n  )};\n";
let endIndex = code.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find CyberInput chunk.");
    process.exit(1);
}
endIndex += endStr.length;

let cyberInputCode = code.substring(startIndex, endIndex);
code = code.substring(0, startIndex) + code.substring(endIndex);

// Add mode prop and define focusBorderClass locally
cyberInputCode = cyberInputCode.replace("align = 'right' }: any) => {", "align = 'right', mode = 'BUY' }: any) => {\n    const focusBorderClass = mode === 'BUY' ? 'focus-within:border-[#10b981] focus-within:shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'focus-within:border-[#ef4444] focus-within:shadow-[0_0_10px_rgba(239,68,68,0.2)]';");

const targetPoint = "export const OrderPanel: React.FC<OrderPanelProps> = ({ symbol";
code = code.replace(targetPoint, cyberInputCode + "\n\n" + targetPoint);

code = code.replace(/<CyberInput\b/g, "<CyberInput mode={os.mode}");

fs.writeFileSync('src/components/OrderPanel.tsx', code);
console.log("Success.");
