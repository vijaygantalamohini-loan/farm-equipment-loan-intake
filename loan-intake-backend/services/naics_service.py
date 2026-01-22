"""
NAICS Code Lookup Service

Provides NAICS (North American Industry Classification System) code lookup
based on loan purpose keywords. Expanded mapping with 150+ agricultural,
equipment, construction, and transportation-related terms.
"""

# NAICS codes for agricultural equipment and common loan purposes
# Expanded mapping with 150+ keywords for comprehensive coverage
NAICS_MAPPING = {
    # Agriculture - Crop Production (111000 series)
    "farm": {"code": "111000", "description": "Crop Production", "sector": "Agriculture"},
    "farming": {"code": "111000", "description": "Crop Production", "sector": "Agriculture"},
    "crop": {"code": "111000", "description": "Crop Production", "sector": "Agriculture"},
    "crops": {"code": "111000", "description": "Crop Production", "sector": "Agriculture"},
    "row crop": {"code": "111000", "description": "Crop Production", "sector": "Agriculture"},
    "field crop": {"code": "111000", "description": "Crop Production", "sector": "Agriculture"},
    "grain": {"code": "111100", "description": "Oilseed and Grain Farming", "sector": "Agriculture"},
    "corn": {"code": "111150", "description": "Corn Farming", "sector": "Agriculture"},
    "soybean": {"code": "111110", "description": "Soybean Farming", "sector": "Agriculture"},
    "wheat": {"code": "111140", "description": "Wheat Farming", "sector": "Agriculture"},
    "oats": {"code": "111191", "description": "Oilseed and Grain Combination Farming", "sector": "Agriculture"},
    "barley": {"code": "111191", "description": "Oilseed and Grain Combination Farming", "sector": "Agriculture"},
    "rice": {"code": "111160", "description": "Rice Farming", "sector": "Agriculture"},
    "vegetable": {"code": "111200", "description": "Vegetable and Melon Farming", "sector": "Agriculture"},
    "fruit": {"code": "111300", "description": "Fruit and Tree Nut Farming", "sector": "Agriculture"},
    "orchard": {"code": "111300", "description": "Fruit and Tree Nut Farming", "sector": "Agriculture"},
    "vineyard": {"code": "111332", "description": "Grape Vineyards", "sector": "Agriculture"},
    "greenhouse": {"code": "111400", "description": "Greenhouse, Nursery, and Floriculture Production", "sector": "Agriculture"},
    "nursery": {"code": "111400", "description": "Greenhouse, Nursery, and Floriculture Production", "sector": "Agriculture"},
    "cotton": {"code": "111920", "description": "Cotton Farming", "sector": "Agriculture"},
    "hay": {"code": "111940", "description": "Hay Farming", "sector": "Agriculture"},
    "alfalfa": {"code": "111940", "description": "Hay Farming", "sector": "Agriculture"},
    "tobacco": {"code": "111910", "description": "Tobacco Farming", "sector": "Agriculture"},
    "peanut": {"code": "111992", "description": "Peanut Farming", "sector": "Agriculture"},
    
    # Animal Production (112000 series)
    "livestock": {"code": "112000", "description": "Animal Production", "sector": "Agriculture"},
    "dairy farm": {"code": "112120", "description": "Dairy Cattle and Milk Production", "sector": "Agriculture"},
    "dairy cattle": {"code": "112120", "description": "Dairy Cattle and Milk Production", "sector": "Agriculture"},
    "dairy operation": {"code": "112120", "description": "Dairy Cattle and Milk Production", "sector": "Agriculture"},
    "dairy": {"code": "112120", "description": "Dairy Cattle and Milk Production", "sector": "Agriculture"},
    "milk": {"code": "112120", "description": "Dairy Cattle and Milk Production", "sector": "Agriculture"},
    "cattle": {"code": "112111", "description": "Beef Cattle Ranching and Farming", "sector": "Agriculture"},
    "beef": {"code": "112111", "description": "Beef Cattle Ranching and Farming", "sector": "Agriculture"},
    "beef cattle": {"code": "112111", "description": "Beef Cattle Ranching and Farming", "sector": "Agriculture"},
    "ranching": {"code": "112111", "description": "Beef Cattle Ranching and Farming", "sector": "Agriculture"},
    "ranch": {"code": "112111", "description": "Beef Cattle Ranching and Farming", "sector": "Agriculture"},
    "hog": {"code": "112210", "description": "Hog and Pig Farming", "sector": "Agriculture"},
    "pig": {"code": "112210", "description": "Hog and Pig Farming", "sector": "Agriculture"},
    "swine": {"code": "112210", "description": "Hog and Pig Farming", "sector": "Agriculture"},
    "poultry": {"code": "112300", "description": "Poultry and Egg Production", "sector": "Agriculture"},
    "chicken": {"code": "112320", "description": "Broilers and Other Meat Type Chicken Production", "sector": "Agriculture"},
    "turkey": {"code": "112330", "description": "Turkey Production", "sector": "Agriculture"},
    "egg": {"code": "112310", "description": "Chicken Egg Production", "sector": "Agriculture"},
    "sheep": {"code": "112410", "description": "Sheep Farming", "sector": "Agriculture"},
    "lamb": {"code": "112410", "description": "Sheep Farming", "sector": "Agriculture"},
    "goat": {"code": "112420", "description": "Goat Farming", "sector": "Agriculture"},
    "horse": {"code": "112920", "description": "Horse and Other Equine Production", "sector": "Agriculture"},
    "equine": {"code": "112920", "description": "Horse and Other Equine Production", "sector": "Agriculture"},
    "aquaculture": {"code": "112511", "description": "Finfish Farming and Fish Hatcheries", "sector": "Agriculture"},
    "fish farm": {"code": "112511", "description": "Finfish Farming and Fish Hatcheries", "sector": "Agriculture"},
    "beekeeping": {"code": "112910", "description": "Apiculture", "sector": "Agriculture"},
    "honey": {"code": "112910", "description": "Apiculture", "sector": "Agriculture"},
    
    # Forestry and Logging (113000 series)
    "forestry": {"code": "113000", "description": "Forestry and Logging", "sector": "Agriculture"},
    "logging": {"code": "113310", "description": "Logging", "sector": "Agriculture"},
    "timber": {"code": "113310", "description": "Logging", "sector": "Agriculture"},
    "wood": {"code": "113310", "description": "Logging", "sector": "Agriculture"},
    "tree farm": {"code": "113110", "description": "Timber Tract Operations", "sector": "Agriculture"},
    "lumber": {"code": "113310", "description": "Logging", "sector": "Agriculture"},
    
    # Agricultural Support Activities (115000 series)
    "agricultural": {"code": "115000", "description": "Support Activities for Agriculture and Forestry", "sector": "Agriculture"},
    "farm support": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "crop services": {"code": "115000", "description": "Support Activities for Agriculture and Forestry", "sector": "Agriculture"},
    "harvesting": {"code": "115113", "description": "Crop Harvesting, Primarily by Machine", "sector": "Agriculture"},
    "custom harvest": {"code": "115113", "description": "Crop Harvesting, Primarily by Machine", "sector": "Agriculture"},
    "plowing": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "planting": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "cultivating": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "spraying": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "fertilizing": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "pest control": {"code": "115112", "description": "Soil Preparation, Planting, and Cultivating", "sector": "Agriculture"},
    "farm labor": {"code": "115115", "description": "Farm Labor Contractors and Crew Leaders", "sector": "Agriculture"},
    "farm management": {"code": "115116", "description": "Farm Management Services", "sector": "Agriculture"},
    
    # Farm Equipment and Machinery (333111)
    # Tractor-specific entries (context-specific matches first, then general)
    "farm tractor": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "agricultural tractor": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "row crop tractor": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "utility tractor": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "compact tractor": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "sub-compact tractor": {"code": "333112", "description": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", "sector": "Manufacturing"},
    "lawn tractor": {"code": "333112", "description": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", "sector": "Manufacturing"},
    "garden tractor": {"code": "333112", "description": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", "sector": "Manufacturing"},
    "riding mower": {"code": "333112", "description": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", "sector": "Manufacturing"},
    "zero turn": {"code": "333112", "description": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", "sector": "Manufacturing"},
    "construction tractor": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "crawler tractor": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "track tractor": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "tractor": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing (General)", "sector": "Manufacturing"},
    "equipment": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "machinery": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "harvester": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "combine": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "baler": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "planter": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "seeder": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "sprayer": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "spreader": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "cultivator": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "plow": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "disc": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "tillage": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "implement": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "loader": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "skid steer": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "forage": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "mower": {"code": "333112", "description": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", "sector": "Manufacturing"},
    "tedder": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "rake": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    
    # Construction Equipment (333120)
    "construction": {"code": "237000", "description": "Heavy and Civil Engineering Construction", "sector": "Construction"},
    "excavator": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "excavation": {"code": "238910", "description": "Site Preparation Contractors", "sector": "Construction"},
    "bulldozer": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "dozer": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "backhoe": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "grader": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "compactor": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "roller": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "scraper": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "earthmoving": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    "land clearing": {"code": "238910", "description": "Site Preparation Contractors", "sector": "Construction"},
    "grading": {"code": "238910", "description": "Site Preparation Contractors", "sector": "Construction"},
    "trencher": {"code": "333120", "description": "Construction Machinery Manufacturing", "sector": "Manufacturing"},
    
    # Transportation (484000 series)
    "hauling": {"code": "484000", "description": "Truck Transportation", "sector": "Transportation"},
    "trucking": {"code": "484000", "description": "Truck Transportation", "sector": "Transportation"},
    "transport": {"code": "484000", "description": "Truck Transportation", "sector": "Transportation"},
    "semi": {"code": "484121", "description": "General Freight Trucking, Long-Distance", "sector": "Transportation"},
    "semi-truck": {"code": "484121", "description": "General Freight Trucking, Long-Distance", "sector": "Transportation"},
    "trailer": {"code": "484121", "description": "General Freight Trucking, Long-Distance", "sector": "Transportation"},
    "dump truck": {"code": "484220", "description": "Specialized Freight (except Used Goods) Trucking, Local", "sector": "Transportation"},
    "grain truck": {"code": "484220", "description": "Specialized Freight (except Used Goods) Trucking, Local", "sector": "Transportation"},
    "livestock hauling": {"code": "484220", "description": "Specialized Freight (except Used Goods) Trucking, Local", "sector": "Transportation"},
    
    # Other Equipment Categories
    "utility vehicle": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "utv": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "atv": {"code": "336991", "description": "Motorcycle, Bicycle, and Parts Manufacturing", "sector": "Manufacturing"},
    "all-terrain": {"code": "336991", "description": "Motorcycle, Bicycle, and Parts Manufacturing", "sector": "Manufacturing"},
    "gator": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "pickup": {"code": "484000", "description": "Truck Transportation", "sector": "Transportation"},
    "pickup truck": {"code": "484000", "description": "Truck Transportation", "sector": "Transportation"},
    "service truck": {"code": "484000", "description": "Truck Transportation", "sector": "Transportation"},
    
    # Irrigation and Water Management
    "irrigation": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "pivot": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "center pivot": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "water": {"code": "333111", "description": "Farm Machinery and Equipment Manufacturing", "sector": "Manufacturing"},
    "pump": {"code": "333911", "description": "Pump and Pumping Equipment Manufacturing", "sector": "Manufacturing"},
    
    # Dealership and Sales
    "dealership": {"code": "423820", "description": "Farm and Garden Machinery and Equipment Merchant Wholesalers", "sector": "Wholesale Trade"},
    "dealer": {"code": "423820", "description": "Farm and Garden Machinery and Equipment Merchant Wholesalers", "sector": "Wholesale Trade"},
    "sales": {"code": "423820", "description": "Farm and Garden Machinery and Equipment Merchant Wholesalers", "sector": "Wholesale Trade"},
    "retail": {"code": "444220", "description": "Nursery, Garden Center, and Farm Supply Stores", "sector": "Retail Trade"},
    "parts": {"code": "423820", "description": "Farm and Garden Machinery and Equipment Merchant Wholesalers", "sector": "Wholesale Trade"},
    
    # General Business Operations
    "business": {"code": "111000", "description": "Crop Production (General)", "sector": "Agriculture"},
    "working capital": {"code": "111000", "description": "Crop Production (General)", "sector": "Agriculture"},
    "operations": {"code": "111000", "description": "Crop Production (General)", "sector": "Agriculture"},
    "expansion": {"code": "111000", "description": "Crop Production (General)", "sector": "Agriculture"},
    "purchase": {"code": "111000", "description": "Crop Production (General)", "sector": "Agriculture"},
}


def lookup_naics_code(purpose: str) -> dict:
    """
    Look up NAICS code based on loan purpose.
    
    Args:
        purpose: The loan purpose description
        
    Returns:
        Dictionary with NAICS information:
        - found: bool
        - naics_code: str
        - description: str
        - sector: str
        - purpose: str (original input)
    """
    purpose_lower = purpose.lower()
    
    # Sort keywords by length (longest first) to match more specific terms first
    # This ensures "dairy farm" matches "dairy" before "farm"
    sorted_keywords = sorted(NAICS_MAPPING.items(), key=lambda x: len(x[0]), reverse=True)
    
    # Find best match - check for keyword in purpose
    matched_code = None
    for keyword, naics_info in sorted_keywords:
        if keyword in purpose_lower:
            matched_code = naics_info
            break
    
    # Default to general farming if no specific match
    if not matched_code:
        matched_code = {"code": "111000", "description": "Crop Production (Default)", "sector": "Agriculture"}
    
    return {
        "found": True,
        "naics_code": matched_code["code"],
        "description": matched_code["description"],
        "sector": matched_code["sector"],
        "purpose": purpose
    }
