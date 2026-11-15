const fs = require('fs');

const pages = [
    "src/app/(app)/business/[id]/page.tsx",
    "src/app/(app)/business/[id]/assets/page.tsx",
    "src/app/(app)/business/[id]/cashflow/page.tsx",
    "src/app/(app)/business/[id]/clients/page.tsx",
    "src/app/(app)/business/[id]/expenses/page.tsx",
    "src/app/(app)/business/[id]/inventory/page.tsx",
    "src/app/(app)/business/[id]/inventory/reconciliation/page.tsx",
    "src/app/(app)/business/[id]/invoicing/page.tsx",
    "src/app/(app)/business/[id]/orders/page.tsx",
    "src/app/(app)/business/[id]/payroll/page.tsx",
    "src/app/(app)/business/[id]/pos/page.tsx",
    "src/app/(app)/business/[id]/profitability/page.tsx",
    "src/app/(app)/business/[id]/reports/page.tsx",
    "src/app/(app)/business/[id]/sales/page.tsx",
    "src/app/(app)/business/[id]/settings/page.tsx",
    "src/app/(app)/business/[id]/suppliers/page.tsx",
    "src/app/(app)/business/[id]/tax-guide/page.tsx"
];

pages.forEach(pagePath => {
    let content = fs.readFileSync(pagePath, 'utf8');
    // Remove the export line
    content = content.replace(/\nexport \{ generateStaticParams \} from '@\/lib\/static-params';?\n?/g, '');
    fs.writeFileSync(pagePath, content, 'utf8');
    console.log(`Removed from ${pagePath}`);
});

console.log('Done!');
