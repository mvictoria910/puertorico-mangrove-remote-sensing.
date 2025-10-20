# Load necessary libraries
library(tidyverse)
library(gridExtra)
library(grid)

# Set working directory and load the data
setwd("C:/Users/marie/OneDrive - East Carolina University/RStudio")
df <- read.csv("C:/Users/marie/Downloads/spectralplots_2023v2_03072025.csv")

# Convert data to long format for spectral bands
df_long <- df %>%
  pivot_longer(cols = c(SR_B2, SR_B3, SR_B4, SR_B5, SR_B6), 
               names_to = "Band", 
               values_to = "Reflectance")

# Update 'landcover' to the correct factor levels
df_long$landcover <- factor(df_long$landcover, 
                            levels = c(1, 2, 3, 4, 5, 6), 
                            labels = c("Mangrove", "Built", "Water", "Forest", "Bare", "Vegetation"))

# Calculate mean reflectance for each band and landcover class
df_summary <- df_long %>%
  group_by(Band, landcover) %>%
  summarize(mean_reflectance = mean(Reflectance, na.rm = TRUE),
            .groups = "drop")

# Create separate tables for each landcover class for spectral bands
band_tables_list <- list()

for (class in levels(df_long$landcover)) {
  df_class <- df_summary %>% filter(landcover == class)
  table <- df_class %>%
    select(Band, mean_reflectance) %>%
    arrange(Band)
  band_tables_list[[class]] <- table
}

# Process the indices (GCVI, MNDWI, NDVI, SR)
df_clean <- df %>%
  filter(!is.na(GCVI) & !is.na(MNDWI) & !is.na(NDVI) & !is.na(SR)) %>%
  filter(is.finite(GCVI) & is.finite(MNDWI) & is.finite(NDVI) & is.finite(SR))

df_long_indices <- df_clean %>%
  pivot_longer(cols = c(GCVI, MNDWI, NDVI, SR), 
               names_to = "Index", 
               values_to = "Reflectance")

df_long_indices$landcover <- factor(df_long_indices$landcover, 
                                    levels = c(1, 2, 3, 4, 5, 6), 
                                    labels = c("Mangrove", "Built", "Water", "Forest", "Bare", "Vegetation"))

# Calculate mean reflectance for each index and landcover class
index_summary <- df_long_indices %>%
  group_by(Index, landcover) %>%
  summarize(mean_reflectance = mean(Reflectance, na.rm = TRUE),
            .groups = "drop")

# === THIS IS THE KEY CHANGE ===

# Create separate tables for each index (NOT by landcover!)
index_tables_list <- list()

for (index_name in unique(index_summary$Index)) {
  df_index <- index_summary %>% filter(Index == index_name)
  table <- df_index %>%
    select(landcover, mean_reflectance) %>%
    arrange(landcover)
  index_tables_list[[index_name]] <- table
}

# =================================

# Create a list of table grobs for spectral bands (still by class)
band_table_grobs <- list()

for (class_name in levels(df_long$landcover)) {
  band_table <- band_tables_list[[class_name]]
  band_title <- textGrob(paste(class_name, "Spectral Bands"), gp = gpar(fontsize = 16, fontface = "bold"))
  band_table_grob <- tableGrob(band_table, theme = ttheme_minimal(base_size = 12))
  band_table_panel <- arrangeGrob(band_title, band_table_grob, ncol = 1, heights = c(0.1, 0.9))
  
  band_table_grobs[[class_name]] <- band_table_panel
}

# Create a list of table grobs for indices (now by index!)
index_table_grobs <- list()

for (index_name in names(index_tables_list)) {
  index_table <- index_tables_list[[index_name]]
  index_title <- textGrob(paste(index_name, "Indices by Landcover"), gp = gpar(fontsize = 16, fontface = "bold"))
  index_table_grob <- tableGrob(index_table, theme = ttheme_minimal(base_size = 12))
  index_table_panel <- arrangeGrob(index_title, index_table_grob, ncol = 1, heights = c(0.1, 0.9))
  
  index_table_grobs[[index_name]] <- index_table_panel
}

# Combine and Display everything nicely
# Spectral Bands (by landcover) and Indices (by index)

grid.arrange(grobs = c(band_table_grobs, index_table_grobs), ncol = 2)

# Calculate data is already ready (df_long_indices)

# Create boxplots for each Index
index_boxplots_list <- list()

for (index_name in unique(df_long_indices$Index)) {
  df_index <- df_long_indices %>% filter(Index == index_name)
  
  p <- ggplot(df_index, aes(x = landcover, y = Reflectance, fill = landcover)) +
    geom_boxplot(outlier.size = 0.5, width = 0.6) +
    labs(title = paste(index_name),
         x = "Landcover Class",
         y = "Index") +
    theme_minimal(base_size = 14) +
    theme(axis.text.x = element_text(angle = 45, hjust = 1),
          legend.position = "none") +
    scale_fill_brewer(palette = "Set2")
  
  index_boxplots_list[[index_name]] <- p
}

# Arrange the boxplots into a panel
grid.arrange(grobs = index_boxplots_list, ncol = 2)

# Save the index boxplots as an SVG
svg("index_boxplots.svg", width = 12, height = 8)  # Open SVG device
grid.arrange(grobs = index_boxplots_list, ncol = 2)  # Plot into the SVG
dev.off()  # Close the SVG device


# For indices
index_anova_results <- list()
index_tukey_results <- list()

for (index_name in unique(df_long_indices$Index)) {
  df_index <- df_long_indices %>% filter(Index == index_name)
  
  # Run ANOVA: Reflectance ~ landcover
  aov_model <- aov(Reflectance ~ landcover, data = df_index)
  
  # Save ANOVA summary
  index_anova_results[[index_name]] <- summary(aov_model)
  
  # If ANOVA significant, do Tukey's post-hoc
  tukey <- TukeyHSD(aov_model)
  index_tukey_results[[index_name]] <- tukey
}

# Print results
for (index_name in names(index_anova_results)) {
  cat("\n\n=== ANOVA Results for", index_name, "===\n")
  print(index_anova_results[[index_name]])
  
  cat("\n--- Tukey HSD Post-Hoc for", index_name, "---\n")
  print(index_tukey_results[[index_name]])
}


# -------------------------------
# ANOVA and Tukey HSD for Spectral Bands
# -------------------------------

# List of bands
bands <- unique(df_long$Band)

# Loop through each band
for (b in bands) {
  cat("\n=== ANOVA Results for", b, "===\n")
  
  # Filter data for the specific band
  df_band <- df_long %>% filter(Band == b)
  
  # Run ANOVA
  aov_model <- aov(Reflectance ~ landcover, data = df_band)
  summary(aov_model) %>% print()
  
  # Tukey HSD Post-Hoc
  cat("\n--- Tukey HSD Post-Hoc for", b, "---\n")
  tukey_results <- TukeyHSD(aov_model)
  print(tukey_results)
}
