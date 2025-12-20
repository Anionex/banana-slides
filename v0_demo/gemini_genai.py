from google import genai
from google.genai import types
from PIL import Image
from dotenv import load_dotenv
import os
load_dotenv()

client = genai.Client(
    http_options=types.HttpOptions(
        base_url=os.getenv("GOOGLE_API_BASE")
    ),
    api_key=os.getenv("GOOGLE_API_KEY")
)

DEFAULT_ASPECT_RATIO = "16:9"  # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"
DEFAULT_RESOLUTION = "2K"  # "1K", "2K", "4K"


def gen_image(prompt: str, ref_image_path: str, aspect_ratio: str = DEFAULT_ASPECT_RATIO, 
              resolution: str = DEFAULT_RESOLUTION):
    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=[
            prompt,
            Image.open(ref_image_path),
        ],
        config=types.GenerateContentConfig(
            response_modalities=['TEXT', 'IMAGE'],
        )
    )

    for part in response.parts:
        if part.text is not None:   
            print(part.text)
        else:
            # Try to get image from part
            try:
                image = part.as_image()
                if image:
                    return image
            except:
                pass
    
    return None


def gen_json_text(prompt: str, model: str = "gemini-3-flash-preview") -> str:
    response = client.models.generate_content(
        model=model, contents=prompt,
          config=types.GenerateContentConfig(
             thinking_config=types.ThinkingConfig(thinking_budget=1000),
         ),
    )
    try:
        return response.text.strip().strip("```json").strip("```").strip()
    except Exception as err:
        print("text: ", response.text)
        raise


def gen_text(prompt: str, model: str = "gemini-3-flash-preview") -> str:
    response = client.models.generate_content(
        model=model, contents=prompt,
          config=types.GenerateContentConfig(
             thinking_config=types.ThinkingConfig(thinking_budget=1000),
         ),
    )
    try:
        return response.text
    except Exception as err:
        print("text: ", response.text)
        raise


if __name__ == "__main__":
    test_prompt = "generate a random json"
    result = gen_json_text(test_prompt)
    print(result)
