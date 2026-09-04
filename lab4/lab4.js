d3.csv("../data/lab4_clean_tweets.csv", d => ({
    tweet_length: +d.tweet_length,
    sentiment: d.roberta_sentiment
}))
.then(data => {

    // 1. 把 tweet 按长度分组
    data.forEach(d => {
        if (d.tweet_length <= 20) {
            d.length_group = "0–20";
        } else if (d.tweet_length <= 40) {
            d.length_group = "21–40";
        } else if (d.tweet_length <= 60) {
            d.length_group = "41–60";
        } else if (d.tweet_length <= 80) {
            d.length_group = "61–80";
        } else if (d.tweet_length <= 100) {
            d.length_group = "81–100";
        } else if (d.tweet_length <= 120) {
            d.length_group = "101–120";
        } else if (d.tweet_length <= 140) {
            d.length_group = "121–140";
        } else {
            d.length_group = "141+";
        }
    });

    // 2. 每个长度区间统计 Negative / Neutral / Positive 数量
    // 3. 再除以该区间总 tweet 数，得到 percentage
    // 4. 用 stacked bar chart 画出来
});
