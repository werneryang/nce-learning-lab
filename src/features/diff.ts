import type { Difference } from '../shared/schema';
export function tokens(text:string,ignorePunctuation=true){
 const pattern=ignorePunctuation?/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu:/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;
 return [...text.matchAll(pattern)].map(m=>({raw:m[0],key:m[0].toLowerCase().replace(/’/g,"'"),start:m.index,end:m.index+m[0].length}));
}
export function compareText(reference:string,learner:string,ignorePunctuation=true){
 const a=tokens(reference,ignorePunctuation),b=tokens(learner,ignorePunctuation);
 if(a.length>2000||b.length>2000)throw new Error('Comparison supports up to 2,000 tokens per draft. Choose a smaller range.');
 const width=b.length+1,dp=new Uint16Array((a.length+1)*width);
 for(let i=0;i<=a.length;i++)dp[i*width]=i;for(let j=0;j<=b.length;j++)dp[j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i*width+j]=Math.min(dp[(i-1)*width+j]+1,dp[i*width+j-1]+1,dp[(i-1)*width+j-1]+(a[i-1].key===b[j-1].key?0:1));
 let i=a.length,j=b.length;const differences:Difference[]=[];
 while(i||j){
  if(i&&j&&a[i-1].key===b[j-1].key){i--;j--;continue;}
  const base={id:`d-${i}-${j}`,strictMatch:false};
  if(i&&j&&dp[i*width+j]===dp[(i-1)*width+j-1]+1){const punctuation=/^[^\p{L}\p{N}]+$/u.test(a[i-1].raw+b[j-1].raw);differences.push({...base,kind:punctuation?'punctuation':'substitution',referenceText:a[i-1].raw,learnerText:b[j-1].raw,referenceRange:[a[i-1].start,a[i-1].end],learnerRange:[b[j-1].start,b[j-1].end]});i--;j--;}
  else if(i&&dp[i*width+j]===dp[(i-1)*width+j]+1){differences.push({...base,kind:'missing',referenceText:a[i-1].raw,referenceRange:[a[i-1].start,a[i-1].end]});i--;}
  else {differences.push({...base,kind:'extra',learnerText:b[j-1].raw,learnerRange:[b[j-1].start,b[j-1].end]});j--;}
 }
 const errors=dp[a.length*width+b.length];
 // A changed order preserves the token multiset. Keep the edit distance metric unchanged.
 if(errors&&a.map(x=>x.key).sort().join('\0')===b.map(x=>x.key).sort().join('\0'))differences.forEach(d=>d.kind='order');
 return {differences:differences.reverse(),fidelity:{wer:a.length?errors/a.length:0,errors,referenceWords:a.length,exact:errors===0,ignorePunctuation}};
}
