// Example data: Example Ramen House's 25 active questions, used by the seed step.
import { buildQuestions, type Business, type Picks } from "@/lib/questions/templates";

export const exampleRamenHouse: Business = { cuisine: "ramen", city: "Irvine", state: "CA" };

export const exampleRamenHousePicks: Picks = {
  landmarks: ["Irvine Spectrum Center", "Diamond Jamboree", "UC Irvine"],
  areas: ["Woodbridge", "Northwood", "Turtle Rock"],
  dietary: ["vegan", "vegetarian"],
  occasion: ["date night"],
};

export const exampleRamenHouseQuestions = buildQuestions(exampleRamenHouse, exampleRamenHousePicks);
