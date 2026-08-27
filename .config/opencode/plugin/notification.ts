// import type { Plugin } from "@opencode-ai/plugin";
//
// export const NotificationPlugin: Plugin = async ({ $, client }) => {
//   return {
//     event: async ({ event }) => {
//       // Send notification on session completion
//       if (event.type === "session.idle") {
//         const sound = "Glass";
//         try {
//           // Fetch session details to get the title
//           const response = await client.session.get({
//             path: { id: event.properties.sessionID },
//           });
//           const sessionName = response.data?.title || "Session";
//           await $`osascript -e 'display notification "${sessionName} completed!" with title "opencode" sound name "${sound}"'`;
//         } catch (error) {
//           // Fallback to generic message if session fetch fails
//           await $`osascript -e 'display notification "Session completed!" with title "opencode" sound name "${sound}"'`;
//         }
//       }
//
//       // Send notification on permission request
//       if (event.type === "permission.updated") {
//         const permission = event.properties;
//         const permissionType = permission.type;
//         const permissionTitle = permission.title;
//
//         // Escape quotes to prevent command injection
//         const escapedTitle = permissionTitle.replace(/'/g, "'\\''").replace(/"/g, '\\"');
//         const escapedType = permissionType.replace(/'/g, "'\\''").replace(/"/g, '\\"');
//
//         try {
//           await $`osascript -e 'display notification "Permission required: ${escapedTitle}" with title "opencode - ${escapedType}" sound name "Basso"'`;
//         } catch (error) {
//           // Fallback to simple notification if detailed one fails
//           await $`osascript -e 'display notification "Permission required"'`;
//         }
//       }
//     },
//   };
// };
