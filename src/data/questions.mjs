// 自写演示题。正式学科题库尚未接入。
export const questions = [
  { id:'ocean', topic:'地理', prompt:'地球上面积最大的海洋是？', options:['大西洋','印度洋','太平洋','北冰洋'], answer:2, explanation:'太平洋是地球上面积最大的海洋。', reward:{type:'troops',value:18}, enemies:12, loss:8 },
  { id:'plant', topic:'自然', prompt:'植物进行光合作用，主要吸收哪种气体？', options:['氧气','二氧化碳','氮气','氢气'], answer:1, explanation:'植物通过光合作用，利用光能将二氧化碳和水转化为有机物，并释放氧气。', reward:{type:'shield',value:24}, enemies:18, loss:14 },
  { id:'square', topic:'数学', prompt:'一个正方形的边长是 6，面积是多少？', options:['12','24','30','36'], answer:3, explanation:'正方形面积 = 边长 × 边长，所以 6 × 6 = 36。', reward:{type:'multiply',value:2}, enemies:24, loss:17 },
  { id:'poem', topic:'语文', prompt:'“海内存知己，天涯若比邻”的作者是？', options:['王勃','李白','杜甫','白居易'], answer:0, explanation:'这两句诗出自唐代王勃的《送杜少府之任蜀州》。', reward:{type:'troops',value:24}, enemies:30, loss:22 },
  { id:'light', topic:'科学', prompt:'在真空中，下列哪一种传播得最快？', options:['声音','光','海浪','地震波'], answer:1, explanation:'光可以在真空中传播；声音、海浪和地震波都需要介质。', reward:{type:'shield',value:36}, enemies:36, loss:24 },
  { id:'fraction', topic:'数学', prompt:'下面哪个数与 3/4 相等？', options:['0.25','0.5','0.75','1.25'], answer:2, explanation:'3 ÷ 4 = 0.75。', reward:{type:'multiply',value:2}, enemies:44, loss:28 },
];
export const rewardLabel = r => r.type === 'shield' ? `护盾 +${r.value}` : r.type === 'multiply' ? `兵力 ×${r.value}` : `增兵 +${r.value}`;
