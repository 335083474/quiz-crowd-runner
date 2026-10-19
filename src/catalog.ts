import {validateQuestions,ACTIVE_STORAGE} from './data/banks.mjs';
export type CatalogItem={id:string,name:string,subject:string,year:string,count:number,status:string,types:Record<string,number>,sourceFile:string};
export type CatalogBank=CatalogItem&{questions:any[]};
let items:CatalogItem[]|null=null,loaded:CatalogBank|undefined;
const root=import.meta.env.BASE_URL+'banks/';
async function read(path:string){const response=await fetch(root+path);if(!response.ok)throw Error('题库加载失败，请检查网络后重试。');return response.json();}
export async function loadCatalog(){if(!items){const data=await read('index.json');if(!Array.isArray(data.items))throw Error('题库目录格式错误。');items=data.items.sort((a:CatalogItem,b:CatalogItem)=>b.year.localeCompare(a.year)||a.subject.localeCompare(b.subject)||a.name.localeCompare(b.name,'zh-CN'));}return items!;}
export function catalogBank(){return loaded;}
export async function selectCatalogBank(id:string){
 const item=(await loadCatalog()).find(b=>b.id===id);if(!item||item.status!=='ready'||!item.count)throw Error('这份试卷尚未整理为可玩题库。');
 const data=await read(encodeURIComponent(item.id)+'.json');const questions=validateQuestions(data.questions);if(questions.length!==item.count)throw Error('题库内容与目录不一致。');
 const next={...item,questions};localStorage.setItem(ACTIVE_STORAGE,id);loaded=next;return next;
}
export async function restoreCatalogBank(){const id=localStorage.getItem(ACTIVE_STORAGE);if(id?.startsWith('tiku-'))await selectCatalogBank(id);}
