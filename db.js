const { neon } = require("@neondatabase/serverless");
require("dotenv").config();

// const { lastDayOfDecade } = require("date-fns");
const db = process.env.POSTGRES_URL;
const wishlist_api = process.env.API_URL_WL;
const progress_api = process.env.API_URL_PG;
const complete_api = process.env.API_URL_COM;

const token = process.env.EGGPLANT_TOKEN;

const sql = neon(db); //--connect to database

async function getData(url, token) {
  try {
    const data = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data1 = await data.json();
    return data1.data;
  } catch (err) {
    console.log(err);
  }
}

async function updateItem(items) {
  try {
    for (const data of items) {
      await sql`
        INSERT INTO movies (
          uuid,
          cover_image_url,
          shelf_type,
          title,
          brief,
          rating,
          created_time,
          type,
          rating_grade,
          comment_text,
          update_time
        ) VALUES (
         ${data.item.uuid},
          ${data.item.cover_image_url},
          ${data.shelf_type},
          ${data.item.title},
          ${data.item.brief},
          ${data.item.rating},
          ${new Date(data.created_time)}, -- Ensure date format
          ${data.item.type},
          ${data.rating_grade},
          ${data.comment_text || null}, -- Handle nullable fields
          ${new Date().toISOString()}
        )
        ON CONFLICT (uuid) DO UPDATE SET
          cover_image_url = EXCLUDED.cover_image_url,
          shelf_type = EXCLUDED.shelf_type,
          title = EXCLUDED.title,
          brief = EXCLUDED.brief,
          rating = EXCLUDED.rating,
          created_time = EXCLUDED.created_time,
          type = EXCLUDED.type,
          rating_grade = EXCLUDED.rating_grade,
          comment_text = EXCLUDED.comment_text,
          update_time = EXCLUDED.update_time
      `;
    }

    console.log("Movies successfully inserted or updated!");
  } catch (err) {
    console.error("Error fetching or storing movies:", err);
  }
}

async function updateStoreItem() {
  const last_update_time =
    await sql`SELECT update_time FROM update_log ORDER BY id DESC LIMIT 1 `;
  const lastUpdateTime =
    last_update_time.length > 0
      ? new Date(last_update_time[0].update_time) // Convert to Date object
      : new Date(0);

  let wishlist_data = await getData(wishlist_api, token);
  let progress_data = await getData(progress_api, token);
  let complete_data = await getData(complete_api, token);


  function filterDate(data) {
    return data.filter((item) => new Date(item.created_time) > lastUpdateTime);
  }
  wishlist_data = filterDate(wishlist_data);
  progress_data = filterDate(progress_data);
  complete_data = filterDate(complete_data);
  //   insert new update time into the log
  await sql`INSERT INTO update_log(id,update_time) VALUES (DEFAULT,${new Date().toISOString()})`;
  return { wishlist_data, progress_data, complete_data };
}

async function updateAndStoreItem() {
  try {
    const { wishlist_data, progress_data, complete_data } =
      await updateStoreItem();

    await updateItem(wishlist_data);

    await updateItem(progress_data);

    await updateItem(complete_data);
  } catch (err) {
    console.error("Error in updateAndStoreItem:", err);
  }
}

updateAndStoreItem();
