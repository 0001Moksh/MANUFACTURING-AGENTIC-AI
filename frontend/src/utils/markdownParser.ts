export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;

  // Tables
  // Match a markdown table block
  const tableRegex = /((?:(?:\|.*?)+\|\r?\n)+)/gm;
  html = html.replace(tableRegex, (match) => {
    // If it's just a bunch of pipes but no separator row, it might not be a table.
    if (!match.includes('---')) return match;

    const lines = match.trim().split(/\r?\n/);
    let tableHtml = '<div class="table-container my-3 overflow-x-auto"><table class="w-full text-left border-collapse border border-border-color text-[12px]">';
    
    lines.forEach((line, index) => {
      // Skip the separator line
      if (line.match(/^\|?[-:| ]+\|?$/)) return;
      
      let cells = line.split('|');
      // Trim empty first and last elements if table starts/ends with |
      if (cells.length > 0 && cells[0].trim() === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
      
      if (cells.length === 0) return;

      tableHtml += '<tr class="hover:bg-black/5 transition-colors">';
      cells.forEach(cell => {
        const content = cell.trim();
        if (index === 0) {
          tableHtml += `<th class="p-2 border-b border-border-color bg-canvas font-bold">${content}</th>`;
        } else {
          tableHtml += `<td class="p-2 border-b border-border-color/30">${content}</td>`;
        }
      });
      tableHtml += '</tr>';
    });
    
    tableHtml += '</table></div>';
    return tableHtml;
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-[14px] font-bold mt-3 mb-1 text-ink">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-[15px] font-extrabold mt-4 mb-2 text-ink">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-[18px] font-black mt-4 mb-2 text-teal-deep">$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-ink">$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Lists
  // Simple bullet lists
  html = html.replace(/^([ \t]*)- (.*$)/gim, '<li class="ml-4 list-disc">$2</li>');
  html = html.replace(/^([ \t]*)\* (.*$)/gim, '<li class="ml-4 list-disc">$2</li>');
  
  // Wrap consecutive list items in <ul>
  html = html.replace(/(<li.*?>.*?<\/li>\s*)+/g, '<ul class="my-2 space-y-1">$&</ul>');

  // Line breaks for remaining newlines (not inside HTML tags ideally, but a simple replace is fine for this bot)
  // Prevent replacing newlines that are inside table/ul tags
  html = html.replace(/\n(?!(?:.*?<tr|.*?<td|.*?<th|.*?<\/table|.*?<li|.*?<\/ul|.*?<\/div))/g, '<br />');
  
  // Remove duplicate breaks
  html = html.replace(/(<br \/>\s*){2,}/g, '<br /><br />');

  return html;
}
