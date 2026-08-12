from PIL import Image, ImageDraw

def make_circle(image_path, output_path):
    img = Image.open(image_path).convert("RGBA")
    
    # Ensure square
    size = min(img.size)
    left = (img.width - size) // 2
    top = (img.height - size) // 2
    right = (img.width + size) // 2
    bottom = (img.height + size) // 2
    img = img.crop((left, top, right, bottom))
    
    # Create mask
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + img.size, fill=255)
    
    # Apply mask
    img.putalpha(mask)
    img.save(output_path)

make_circle('logo.png', 'logo.png')
