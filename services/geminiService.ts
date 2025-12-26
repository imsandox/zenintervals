
/**
 * 使用硅基流动 (SiliconFlow) 的 DeepSeek 模型获取正念引导语。
 * 针对用户提供的专用 API Key 进行配置，确保语录生成的稳定性。
 */
export const getMindfulIntention = async (): Promise<string> => {
  // 使用您提供的硅基流动专用 API Key
  const apiKey = 'sk-dwefqbckfildanuuixvodejaxliwvlrkppgtrpcbwxkdfdcr';
  
  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的正念禅修导师。请为练习者提供一句关于呼吸、当下、觉察的短语。'
          },
          {
            role: 'user',
            content: '请写一句正念引导语。要求：字数15字以内，语气轻柔且富有诗意。直接输出正文，严禁带任何引号或标点符号。'
          }
        ],
        temperature: 0.8,
        max_tokens: 50,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("SiliconFlow API 访问异常:", errorData);
      throw new Error(`API 返回状态码: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content?.trim() || "呼吸，觉察当下";
    
    // 强力清洗逻辑：去除首尾引号、多余空格及句末标点
    content = content.replace(/["“'‘”’]/g, '').replace(/[。！!]$/, '');
    
    return content;
  } catch (error) {
    console.error("无法从硅基流动获取语录:", error);
    
    // 优雅降级：当 API 不可用时，随机返回精心准备的禅意语录
    const fallbacks = [
      "每一次呼吸，都是回归当下的旅程",
      "坐看云起，此时此刻即是永恒",
      "允许一切发生，心如如不动",
      "在呼吸的起伏中，找回内在的宁静",
      "不忧过去，不惧未来，只在当下",
      "静极生慧，让心自然安顿",
      "世界喧嚣，内心自有清凉地",
      "放下万缘，听见呼吸的声音"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};
