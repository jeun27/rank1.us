// G1 on Example data: the videos each YouTube fix's stored evidence lists (invented, no real YouTube ids).
const v = (id: string, title: string) => ({ id, title, url: `https://www.youtube.com/watch?v=example-${id}` });

export const exampleYoutubeFixVideos = {
  R19: [v("2", "A night at the counter")],
  R20: [v("1", "Our tonkotsu ramen, start to finish"), v("2", "A night at the counter")],
  R21: [v("1", "Our tonkotsu ramen, start to finish")],
};
