from PIL import Image, ImageDraw, ImageFont
import os

# Create directory if it doesn't exist
os.makedirs("client/public", exist_ok=True)

# Function to create an icon
def create_icon(size):
    # Create a new image with a purple background
    img = Image.new('RGB', (size, size), '#4F46E5')
    draw = ImageDraw.Draw(img)
    
    # Draw a white circle background
    padding = size // 8
    draw.ellipse([padding, padding, size - padding, size - padding], fill='white')
    
    # Draw the letter 'A' for Attendance
    text = 'A'
    
    # Try to use a bold font, fallback to default if not available
    try:
        font_size = size // 3
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Use default font if truetype fonts are not available
        font = ImageFont.load_default()
    
    # Calculate text position
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2 - size // 10)
    
    # Draw the text
    draw.text(position, text, fill='#4F46E5', font=font)
    
    return img

# Create icons
icon_192 = create_icon(192)
icon_192.save("client/public/icon-192.png")

icon_512 = create_icon(512)
icon_512.save("client/public/icon-512.png")

# Create a maskable icon with safe zone
def create_maskable_icon(size):
    # Create a new image with a purple background
    img = Image.new('RGB', (size, size), '#4F46E5')
    draw = ImageDraw.Draw(img)
    
    # Draw the letter 'A' for Attendance
    text = 'A'
    
    # Try to use a bold font, fallback to default if not available
    try:
        font_size = size // 4  # Smaller to fit in safe zone
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Use default font if truetype fonts are not available
        font = ImageFont.load_default()
    
    # Calculate text position
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2)
    
    # Draw the text in white
    draw.text(position, text, fill='white', font=font)
    
    return img

# Create maskable versions
maskable_192 = create_maskable_icon(192)
maskable_192.save("client/public/icon-maskable-192.png")

maskable_512 = create_maskable_icon(512)
maskable_512.save("client/public/icon-maskable-512.png")

print("Icons generated successfully!")