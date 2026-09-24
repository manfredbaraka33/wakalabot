import json
import time
from google import genai
from google.genai import types
import pandas as pd

# Initialize the Gemini client (uses your GEMINI_API_KEY environment variable)
client = genai.Client()


def fetch_district_batch(batch_df: pd.DataFrame) -> list[dict]:
    """Sends a batch of unique schools to Gemini to return their official District Councils."""
    # Convert batch to a simple dictionary list
    schools_payload = batch_df[["center_id", "school_name", "region"]].to_dict(
        orient="records"
    )

    prompt = f"""
You are an expert on Tanzanian secondary schools and local administration (LGAs).
For each school provided in the list below, determine its official District Council, Municipal Council, or City Council (LGA).

Input list:
{json.dumps(schools_payload, indent=2)}

Return ONLY a strict JSON array containing objects with exact keys: "center_id" and "district".
Example output format:
[
  {{"center_id": "S0101", "district": "Arusha CC"}},
  {{"center_id": "S0108", "district": "Tabora MC"}},
  {{"center_id": "S0316", "district": "Sengerema DC"}}
]
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",  # Fast, accurate, and cost-efficient for text batching
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature for strict factual accuracy
            ),
        )
        return json.loads(response.text)
    except Exception as err:
        print(f"Error while processing batch: {err}")
        return []


def generate_center_district_mapping(
    df: pd.DataFrame, batch_size: int = 50, output_csv: str = "center_districts.csv"
) -> pd.DataFrame:
    """Extracts unique centers, batches them to Gemini, and saves the resulting lookup CSV."""

    # 1. Deduplicate by center_id to avoid unnecessary API calls
    unique_centers = df[["center_id", "school_name", "region"]].drop_duplicates(
        subset=["center_id"]
    )

    results = []
    total_schools = len(unique_centers)
    total_batches = (total_schools + batch_size - 1) // batch_size

    print(
        f"Starting district mapping for {total_schools} unique schools across {total_batches} batches...\n"
    )

    # 2. Loop through in batches
    for start_idx in range(0, total_schools, batch_size):
        batch = unique_centers.iloc[start_idx : start_idx + batch_size]
        current_batch_num = (start_idx // batch_size) + 1

        print(
            f"Processing batch {current_batch_num}/{total_batches} ({len(batch)} schools)..."
        )
        batch_results = fetch_district_batch(batch)
        results.extend(batch_results)

        # Brief pause between batches to respect rate limits
        time.sleep(1)

    # 3. Save to CSV
    lookup_df = pd.DataFrame(results)

    if not lookup_df.empty:
        lookup_df.to_csv(output_csv, index=False)
        print(
            f"\nFinished! Mapping saved to '{output_csv}' with {len(lookup_df)} total records."
        )
    else:
        print("\nNo records processed. Check your API key or connection.")

    return lookup_df


# --- Example Usage ---
if __name__ == "__main__":
    # Load your existing cleaned summary dataframe or CSV
    # df = pd.read_csv("data/cleaned_summary.csv")

    # Sample mock DataFrame
    sample_data = pd.DataFrame(
        [
            {
                "center_id": "S0101",
                "school_name": "ILBORU SECONDARY SCHOOL",
                "region": "ARUSHA",
            },
            {
                "center_id": "S0108",
                "school_name": "TABORA BOYS SECONDARY SCHOOL",
                "region": "TABORA",
            },
            {
                "center_id": "S0316",
                "school_name": "JANETH MAGUFULI SECONDARY SCHOOL",
                "region": "MWANZA",
            },
        ]
    )

    district_lookup = generate_center_district_mapping(
        sample_data, batch_size=50, output_csv="data/center_districts.csv"
    )